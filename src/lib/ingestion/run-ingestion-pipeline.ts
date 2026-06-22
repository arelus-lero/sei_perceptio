import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';

import { assertUploadNotDuplicate } from '@/lib/dedup/check-upload-duplicates';
import { SimilarContentError } from '@/lib/dedup/dedup-errors';
import type { UserRole } from '@/lib/db/schema';
import { anonymizeText } from '@/lib/ingestion/anonymizer';
import { extractDocumentTextByType } from '@/lib/ingestion/document-text-extractor';
import { getOcrConcurrency } from '@/lib/ingestion/ocr';
import { getDefaultMaxOcrPages } from '@/lib/ingestion/pdf-text';
import { extractSeiMetadata } from '@/lib/ingestion/metadata-extractor';
import { assertSigiloIngestionAllowed } from '@/lib/ingestion/sigilo-guard';
import { UploadPipelineError } from '@/lib/ingestion/upload-pipeline-error';
import { createRequestLogger, logError } from '@/lib/logger';
import type { Chunk } from '@/lib/rag/chunking';
import { chunkText } from '@/lib/rag/chunking';
import {
  buildBatches,
  embedBatchWithRetry,
  EmbedError,
  type EmbedErrorCode,
  embeddingToPgVector,
} from '@/lib/rag/embedding';
import type {
  FonteIngestionStatus,
  IngestionJobStage,
  IngestionJobState,
} from '@/types/ingestion';

interface RunIngestionPipelineParams {
  supabase: SupabaseClient;
  fonteId: string;
  orgaoId: string;
  userRole: UserRole | null;
  sigiloExceptionJustificativa?: string;
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
}

interface FonteRow {
  id: string;
  caminho_arquivo: string | null;
  titulo: string;
  metadados_json: Record<string, unknown> | null;
  checksum: string | null;
}

const EMBED_CONCURRENCY = 4;

interface EmbedAndPersistResult {
  chunksIndexed: number;
  embeddingAvailable: boolean;
  embeddingError: string | null;
  embeddingErrorCode: EmbedErrorCode | null;
  embeddingRetryable: boolean;
}

interface StoredChunkRow {
  id: string;
  conteudo: string;
  posicao_inicio: number;
  posicao_fim: number;
  metadados_json: Record<string, unknown>;
}

function resolveEmbedFailure(error: unknown): {
  message: string;
  code: EmbedErrorCode;
  retryable: boolean;
} {
  if (error instanceof EmbedError) {
    return {
      message: error.message,
      code: error.code,
      retryable: error.code !== 'bad_dim',
    };
  }

  return {
    message: error instanceof Error ? error.message : 'Falha ao gerar embeddings',
    code: 'failed',
    retryable: true,
  };
}

async function updateChunkEmbeddings(params: {
  supabase: SupabaseClient;
  chunkId: string;
  orgaoId: string;
  embedding: number[];
  metadadosJson: Record<string, unknown>;
}): Promise<void> {
  const { error } = await params.supabase
    .from('chunk')
    .update({
      embedding: embeddingToPgVector(params.embedding),
      metadados_json: {
        ...params.metadadosJson,
        embedding_available: true,
      },
    })
    .eq('id', params.chunkId)
    .eq('orgao_id', params.orgaoId);

  if (error) {
    throw new Error(`Falha ao atualizar embedding do chunk ${params.chunkId}: ${error.message}`);
  }
}

async function reembedExistingChunks(params: {
  supabase: SupabaseClient;
  fonteId: string;
  orgaoId: string;
}): Promise<EmbedAndPersistResult> {
  const { data: rows, error: fetchError } = await params.supabase
    .from('chunk')
    .select('id, conteudo, posicao_inicio, posicao_fim, metadados_json')
    .eq('fonte_id', params.fonteId)
    .eq('orgao_id', params.orgaoId)
    .order('posicao_inicio', { ascending: true });

  if (fetchError) {
    throw new Error(`Falha ao carregar chunks: ${fetchError.message}`);
  }

  const storedChunks = (rows ?? []) as StoredChunkRow[];

  if (storedChunks.length === 0) {
    throw new Error('Nenhum chunk persistido; use reprocessamento completo.');
  }

  const chunksForBatching: Chunk[] = storedChunks.map((row) => ({
    conteudo: row.conteudo,
    tokens:
      typeof row.metadados_json.tokens === 'number'
        ? row.metadados_json.tokens
        : row.conteudo.length,
    posicao_inicio: row.posicao_inicio,
    posicao_fim: row.posicao_fim,
    metadados: {
      ...(row.metadados_json as unknown as Chunk['metadados']),
      posicao_inicio: row.posicao_inicio,
      posicao_fim: row.posicao_fim,
    },
  }));

  const batches = buildBatches(chunksForBatching);
  let cursor = 0;
  let embeddingAvailable = true;
  let embeddingError: string | null = null;
  let embeddingErrorCode: EmbedErrorCode | null = null;

  for (const batch of batches) {
    const batchRows = storedChunks.slice(cursor, cursor + batch.length);

    try {
      const vectors = await embedBatchWithRetry(batch.map((chunk) => chunk.conteudo));

      await Promise.all(
        batchRows.map((row, index) =>
          updateChunkEmbeddings({
            supabase: params.supabase,
            chunkId: row.id,
            orgaoId: params.orgaoId,
            embedding: vectors[index] as number[],
            metadadosJson: row.metadados_json,
          }),
        ),
      );
    } catch (error) {
      const failure = resolveEmbedFailure(error);
      embeddingAvailable = false;
      embeddingError = failure.message;
      embeddingErrorCode = failure.code;

      if (failure.code === 'bad_dim') {
        break;
      }
    }

    cursor += batch.length;
  }

  return {
    chunksIndexed: storedChunks.length,
    embeddingAvailable,
    embeddingError,
    embeddingErrorCode,
    embeddingRetryable: embeddingErrorCode !== 'bad_dim',
  };
}

async function persistChunks(params: {
  supabase: SupabaseClient;
  fonteId: string;
  orgaoId: string;
  batch: Chunk[];
  embeddings: (number[] | null)[];
  embeddingAvailable: boolean;
}): Promise<void> {
  const rows = params.batch.map((chunk, index) => ({
    fonte_id: params.fonteId,
    conteudo: chunk.conteudo,
    posicao_inicio: chunk.posicao_inicio,
    posicao_fim: chunk.posicao_fim,
    embedding: params.embeddings[index]
      ? embeddingToPgVector(params.embeddings[index] as number[])
      : null,
    metadados_json: {
      ...chunk.metadados,
      tokens: chunk.tokens,
      embedding_available: params.embeddingAvailable,
    },
    orgao_id: params.orgaoId,
  }));

  const { error: chunkError } = await params.supabase.from('chunk').insert(rows);

  if (chunkError) {
    throw new Error(`Falha ao persistir chunks: ${chunkError.message}`);
  }
}

async function embedAndPersistChunksStreaming(params: {
  supabase: SupabaseClient;
  fonteId: string;
  orgaoId: string;
  chunks: Chunk[];
}): Promise<EmbedAndPersistResult> {
  if (params.chunks.length === 0) {
    return {
      chunksIndexed: 0,
      embeddingAvailable: true,
      embeddingError: null,
      embeddingErrorCode: null,
      embeddingRetryable: true,
    };
  }

  const limit = pLimit(EMBED_CONCURRENCY);
  const batches = buildBatches(params.chunks);
  let chunksIndexed = 0;
  let embeddingAvailable = true;
  let embeddingError: string | null = null;
  let embeddingErrorCode: EmbedErrorCode | null = null;

  await Promise.all(
    batches.map((batch) =>
      limit(async () => {
        let embeddings: (number[] | null)[] = batch.map(() => null);
        let batchEmbeddingAvailable = true;

        try {
          const vectors = await embedBatchWithRetry(batch.map((chunk) => chunk.conteudo));
          embeddings = vectors;
        } catch (error) {
          batchEmbeddingAvailable = false;
          embeddingAvailable = false;
          const failure = resolveEmbedFailure(error);
          embeddingError = failure.message;
          embeddingErrorCode = failure.code;
        }

        await persistChunks({
          supabase: params.supabase,
          fonteId: params.fonteId,
          orgaoId: params.orgaoId,
          batch,
          embeddings,
          embeddingAvailable: batchEmbeddingAvailable,
        });

        chunksIndexed += batch.length;
      }),
    ),
  );

  return {
    chunksIndexed,
    embeddingAvailable,
    embeddingError,
    embeddingErrorCode,
    embeddingRetryable: embeddingErrorCode !== 'bad_dim',
  };
}

function readDedupFlags(metadados: Record<string, unknown> | null): {
  confirmChecksumDuplicate: boolean;
  confirmSimilarContent: boolean;
} {
  const dedup = metadados?.dedup;

  if (!dedup || typeof dedup !== 'object') {
    return { confirmChecksumDuplicate: false, confirmSimilarContent: false };
  }

  const record = dedup as Record<string, unknown>;

  return {
    confirmChecksumDuplicate: record.checksum_duplicate_confirmed === true,
    confirmSimilarContent: record.similar_content_confirmed === true,
  };
}

async function updateIngestionJobState(
  supabase: SupabaseClient,
  fonteId: string,
  orgaoId: string,
  metadados: Record<string, unknown>,
  patch: Partial<IngestionJobState> & { stage: IngestionJobStage },
  extra?: Record<string, unknown>,
): Promise<void> {
  const currentJob = metadados.ingestion_job;
  const previousJob =
    currentJob && typeof currentJob === 'object'
      ? (currentJob as IngestionJobState)
      : {};

  const nextJob: IngestionJobState = {
    ...previousJob,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const nextMetadados = {
    ...metadados,
    ...extra,
    ingestion_job: nextJob,
  };

  const { error } = await supabase
    .from('fonte')
    .update({ metadados_json: nextMetadados })
    .eq('id', fonteId)
    .eq('orgao_id', orgaoId);

  if (error) {
    throw new Error(`Falha ao atualizar status da ingestão: ${error.message}`);
  }

  metadados.ingestion_job = nextJob;
  Object.assign(metadados, extra ?? {});
}

async function markIngestionFailed(
  supabase: SupabaseClient,
  fonte: FonteRow,
  orgaoId: string,
  stage: IngestionJobStage,
  message: string,
): Promise<void> {
  const metadados = { ...(fonte.metadados_json ?? {}) };

  await supabase
    .from('fonte')
    .update({
      metadados_json: {
        ...metadados,
        status: 'erro' satisfies FonteIngestionStatus,
        ingestion_job: {
          ...(typeof metadados.ingestion_job === 'object' ? metadados.ingestion_job : {}),
          stage,
          error: message,
          updated_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', fonte.id)
    .eq('orgao_id', orgaoId);
}

function resolveFinalStatus(params: {
  requiresOcr: boolean;
  hasText: boolean;
}): FonteIngestionStatus {
  if (params.requiresOcr) {
    return 'requer_ocr';
  }

  if (params.hasText) {
    return 'pronto';
  }

  return 'processando';
}

function resolveCompletionStatus(params: {
  finalStatus: FonteIngestionStatus;
  chunksIndexed: number;
  embeddingAvailable: boolean;
}): FonteIngestionStatus {
  if (
    params.chunksIndexed > 0
    && !params.embeddingAvailable
    && params.finalStatus === 'pronto'
  ) {
    return 'erro_embeddings';
  }

  return params.finalStatus;
}

export async function runIngestionPipeline(
  params: RunIngestionPipelineParams,
): Promise<{
  fonteId: string;
  status: FonteIngestionStatus;
  chunks_indexed: number;
  embedding_available: boolean;
}> {
  const log = createRequestLogger(params.fonteId, {
    route: 'inngest/process-ingestion',
    fonte_id: params.fonteId,
    orgao_id: params.orgaoId,
  });

  const { data: fonte, error: fonteError } = await params.supabase
    .from('fonte')
    .select('id, caminho_arquivo, titulo, metadados_json, checksum')
    .eq('id', params.fonteId)
    .eq('orgao_id', params.orgaoId)
    .single();

  if (fonteError || !fonte) {
    throw new Error(`Fonte ${params.fonteId} não encontrada`);
  }

  const row = fonte as FonteRow;
  const metadados = { ...(row.metadados_json ?? {}) };
  const dedupFlags = readDedupFlags(metadados);
  const confirmChecksumDuplicate =
    params.confirmChecksumDuplicate ?? dedupFlags.confirmChecksumDuplicate;
  const confirmSimilarContent =
    params.confirmSimilarContent ?? dedupFlags.confirmSimilarContent;
  const sigiloJustificativa =
    params.sigiloExceptionJustificativa
    ?? (typeof metadados.sigilo_exception_justificativa === 'string'
      ? metadados.sigilo_exception_justificativa
      : undefined);

  const storagePath = row.caminho_arquivo;
  const fileType = metadados.file_type;
  const filename = typeof metadados.filename === 'string' ? metadados.filename : row.titulo;
  const mimeType = typeof metadados.mime_type === 'string' ? metadados.mime_type : undefined;

  if (!storagePath || typeof fileType !== 'string') {
    throw new Error('Fonte sem caminho de armazenamento ou tipo de arquivo');
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'documentos';

  try {
    await updateIngestionJobState(
      params.supabase,
      params.fonteId,
      params.orgaoId,
      metadados,
      { stage: 'extraction', started_at: new Date().toISOString(), error: null },
    );

    const { data: fileBlob, error: downloadError } = await params.supabase.storage
      .from(bucket)
      .download(storagePath);

    if (downloadError || !fileBlob) {
      throw new UploadPipelineError('storage', downloadError ?? new Error('download failed'));
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const extraction = await extractDocumentTextByType(
      buffer,
      fileType,
      filename,
      {
        deferOcr: false,
        maxPages: getDefaultMaxOcrPages(),
        ocrConcurrency: getOcrConcurrency(),
      },
    );

    const rawText = extraction.text;
    const requiresOcr = extraction.requires_ocr === true;
    let textoParaPersistir = rawText;
    let anonimizada = false;
    let piiStats = null;
    let sigiloExceptionApplied = false;
    const seiMetadata = rawText ? extractSeiMetadata(rawText) : null;

    if (rawText) {
      await updateIngestionJobState(
        params.supabase,
        params.fonteId,
        params.orgaoId,
        metadados,
        { stage: 'anonymization' },
      );

      const sigiloResult = await assertSigiloIngestionAllowed({
        supabase: params.supabase,
        orgaoId: params.orgaoId,
        texto: rawText,
        userRole: params.userRole,
        sigiloExceptionJustificativa: sigiloJustificativa,
      });
      sigiloExceptionApplied = sigiloResult.exception_applied;

      const anonymization = await anonymizeText({ texto: rawText });
      textoParaPersistir = anonymization.texto_anonimizado;
      anonimizada = anonymization.anonymized;
      piiStats = anonymization.stats;
    }

    await updateIngestionJobState(
      params.supabase,
      params.fonteId,
      params.orgaoId,
      metadados,
      { stage: 'deduplication' },
    );

    const dedupResult = await assertUploadNotDuplicate({
      supabase: params.supabase,
      orgaoId: params.orgaoId,
      checksum: row.checksum ?? '',
      texto: textoParaPersistir,
      confirmChecksumDuplicate,
      confirmSimilarContent,
      excludeFonteId: params.fonteId,
    });

    const finalStatus = resolveFinalStatus({
      requiresOcr,
      hasText: Boolean(textoParaPersistir),
    });

    await updateIngestionJobState(
      params.supabase,
      params.fonteId,
      params.orgaoId,
      metadados,
      { stage: 'chunking' },
      {
        extraction: {
          method: extraction.method,
          ocr_applied: extraction.ocr_applied,
          requires_ocr: requiresOcr,
          page_count: extraction.page_count,
          ocr_confidence: extraction.ocr_confidence,
          encoding: extraction.encoding ?? null,
        },
        sei_metadata: seiMetadata,
        anonymization: piiStats
          ? {
              stats: piiStats,
              applied_at: new Date().toISOString(),
            }
          : null,
        sigilo_exception_applied: sigiloExceptionApplied,
        simhash: dedupResult.simhash,
      },
    );

    await params.supabase
      .from('fonte')
      .update({
        conteudo_texto: textoParaPersistir,
        anonimizada,
      })
      .eq('id', params.fonteId)
      .eq('orgao_id', params.orgaoId);

    let chunksIndexed = 0;
    let embeddingAvailable = true;
    let embeddingError: string | null = null;
    let embeddingErrorCode: EmbedErrorCode | null = null;
    let embeddingRetryable = true;

    if (textoParaPersistir) {
      await updateIngestionJobState(
        params.supabase,
        params.fonteId,
        params.orgaoId,
        metadados,
        { stage: 'embedding' },
      );

      const chunks = chunkText({
        texto: textoParaPersistir,
        metadados: {
          fonte_id: params.fonteId,
          filename,
          anonimizada,
          ocr_applied: extraction.ocr_applied,
        },
      });

      if (chunks.length > 0) {
        await updateIngestionJobState(
          params.supabase,
          params.fonteId,
          params.orgaoId,
          metadados,
          { stage: 'indexing' },
        );

        const indexResult = await embedAndPersistChunksStreaming({
          supabase: params.supabase,
          fonteId: params.fonteId,
          orgaoId: params.orgaoId,
          chunks,
        });

        chunksIndexed = indexResult.chunksIndexed;
        embeddingAvailable = indexResult.embeddingAvailable;
        embeddingError = indexResult.embeddingError;
        embeddingErrorCode = indexResult.embeddingErrorCode;
        embeddingRetryable = indexResult.embeddingRetryable;

        if (embeddingError) {
          log.warn(
            {
              err: embeddingError,
              embedding_error_code: embeddingErrorCode,
              fonte_id: params.fonteId,
            },
            'Embed function failed; chunks persisted without vectors',
          );
        }
      }
    }

    const completionStatus = resolveCompletionStatus({
      finalStatus,
      chunksIndexed,
      embeddingAvailable,
    });

    await updateIngestionJobState(
      params.supabase,
      params.fonteId,
      params.orgaoId,
      metadados,
      {
        stage: embeddingAvailable ? 'completed' : 'failed',
        error: embeddingError,
        chunks_indexed: chunksIndexed,
        embedding_available: embeddingAvailable,
      },
      {
        status: completionStatus,
        embedding_error_code: embeddingAvailable ? null : embeddingErrorCode,
        embedding_retryable: embeddingRetryable,
      },
    );

    log.info(
      {
        event: 'ingestion_pipeline_completed',
        fonte_id: params.fonteId,
        status: completionStatus,
        chunks_indexed: chunksIndexed,
        embedding_available: embeddingAvailable,
        embedding_error_code: embeddingErrorCode,
      },
      embeddingAvailable
        ? 'Ingestion pipeline completed'
        : 'Ingestion pipeline completed with embedding failure',
    );

    return {
      fonteId: params.fonteId,
      status: completionStatus,
      chunks_indexed: chunksIndexed,
      embedding_available: embeddingAvailable,
    };
  } catch (error) {
    const message =
      error instanceof SimilarContentError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Falha na ingestão assíncrona';

    logError(log, 'Ingestion pipeline failed', error, { fonte_id: params.fonteId });

    await markIngestionFailed(
      params.supabase,
      row,
      params.orgaoId,
      'failed',
      message,
    );

    throw error;
  }
}

interface FonteReembedRow {
  id: string;
  titulo: string;
  conteudo_texto: string | null;
  metadados_json: Record<string, unknown> | null;
}

export async function runEmbeddingReprocess(params: {
  supabase: SupabaseClient;
  fonteId: string;
  orgaoId: string;
}): Promise<{
  fonteId: string;
  status: FonteIngestionStatus;
  chunks_indexed: number;
  embedding_available: boolean;
}> {
  const log = createRequestLogger(params.fonteId, {
    route: 'ingestion/reembed',
    fonte_id: params.fonteId,
    orgao_id: params.orgaoId,
  });

  const { data: fonte, error: fonteError } = await params.supabase
    .from('fonte')
    .select('id, titulo, conteudo_texto, metadados_json')
    .eq('id', params.fonteId)
    .eq('orgao_id', params.orgaoId)
    .single();

  if (fonteError || !fonte) {
    throw new Error(`Fonte ${params.fonteId} não encontrada`);
  }

  const row = fonte as FonteReembedRow;
  const metadados = { ...(row.metadados_json ?? {}) };

  if (metadados.embedding_error_code === 'bad_dim') {
    throw new Error(
      'Erro de configuração do modelo de embeddings (dimensão inválida). Reprocessamento indisponível.',
    );
  }

  await updateIngestionJobState(
    params.supabase,
    params.fonteId,
    params.orgaoId,
    metadados,
    {
      stage: 'embedding',
      started_at: new Date().toISOString(),
      error: null,
    },
    {
      status: 'processando' satisfies FonteIngestionStatus,
      embedding_error_code: null,
    },
  );

  await updateIngestionJobState(
    params.supabase,
    params.fonteId,
    params.orgaoId,
    metadados,
    { stage: 'indexing' },
  );

  const indexResult = await reembedExistingChunks({
    supabase: params.supabase,
    fonteId: params.fonteId,
    orgaoId: params.orgaoId,
  });

  if (indexResult.embeddingError) {
    log.warn(
      {
        err: indexResult.embeddingError,
        embedding_error_code: indexResult.embeddingErrorCode,
        fonte_id: params.fonteId,
      },
      'Re-embed failed; existing chunks kept without vectors',
    );
  }

  const completionStatus = resolveCompletionStatus({
    finalStatus: 'pronto',
    chunksIndexed: indexResult.chunksIndexed,
    embeddingAvailable: indexResult.embeddingAvailable,
  });

  await updateIngestionJobState(
    params.supabase,
    params.fonteId,
    params.orgaoId,
    metadados,
    {
      stage: indexResult.embeddingAvailable ? 'completed' : 'failed',
      error: indexResult.embeddingError,
      chunks_indexed: indexResult.chunksIndexed,
      embedding_available: indexResult.embeddingAvailable,
    },
    {
      status: completionStatus,
      embedding_error_code: indexResult.embeddingAvailable
        ? null
        : indexResult.embeddingErrorCode,
      embedding_retryable: indexResult.embeddingRetryable,
    },
  );

  log.info(
    {
      event: 'embedding_reprocess_completed',
      fonte_id: params.fonteId,
      status: completionStatus,
      chunks_indexed: indexResult.chunksIndexed,
      embedding_available: indexResult.embeddingAvailable,
      embedding_error_code: indexResult.embeddingErrorCode,
    },
    indexResult.embeddingAvailable
      ? 'Embedding reprocess completed'
      : 'Embedding reprocess completed with failures',
  );

  return {
    fonteId: params.fonteId,
    status: completionStatus,
    chunks_indexed: indexResult.chunksIndexed,
    embedding_available: indexResult.embeddingAvailable,
  };
}

export async function getIngestionStatus(
  supabase: SupabaseClient,
  fonteId: string,
  orgaoId: string,
): Promise<{
  fonte_id: string;
  status: FonteIngestionStatus;
  ingestion_job: IngestionJobState | null;
  checksum: string | null;
  chunks_indexed: number;
}> {
  const { data, error } = await supabase
    .from('fonte')
    .select('id, checksum, metadados_json')
    .eq('id', fonteId)
    .eq('orgao_id', orgaoId)
    .single();

  if (error || !data) {
    throw new Error('Fonte não encontrada');
  }

  const metadados = (data.metadados_json ?? {}) as Record<string, unknown>;
  const statusRaw = metadados.status;
  const status: FonteIngestionStatus =
    statusRaw === 'pronto'
    || statusRaw === 'requer_ocr'
    || statusRaw === 'erro'
    || statusRaw === 'erro_embeddings'
    || statusRaw === 'processando'
      ? statusRaw
      : 'processando';

  const jobRaw = metadados.ingestion_job;
  const ingestionJob =
    jobRaw && typeof jobRaw === 'object' ? (jobRaw as IngestionJobState) : null;

  return {
    fonte_id: data.id,
    status,
    ingestion_job: ingestionJob,
    checksum: data.checksum,
    chunks_indexed: ingestionJob?.chunks_indexed ?? 0,
  };
}

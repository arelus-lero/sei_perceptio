import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/db/schema';
import {
  findChecksumDuplicates,
  findIncompleteFontesByChecksum,
} from '@/lib/dedup/check-upload-duplicates';
import { DuplicateChecksumError } from '@/lib/dedup/dedup-errors';
import { computeChecksum } from '@/lib/ingestion/stage-upload';
import { UploadPipelineError } from '@/lib/ingestion/upload-pipeline-error';
import {
  purgeOrphanFonte,
  resetFonteForReingestion,
} from '@/lib/ingestion/reprocess-fonte';
import { invalidateNotebookRagCache } from '@/lib/rag/query-cache';
import { fetchPublicUrlContent } from '@/lib/ingestion/url-fetch';
import { buildDocumentStorageKey } from '@/lib/utils/storage-key';
import type { FonteIngestionStatus, IngestionJobState } from '@/types/ingestion';

interface StageUrlSourceParams {
  supabase: SupabaseClient;
  orgaoId: string;
  notebookId: string;
  sourceUrl: string;
  titulo?: string;
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
  sigiloExceptionJustificativa?: string;
  userRole: UserRole | null;
}

export interface StageUrlSourceResult {
  fonteId: string;
  status: FonteIngestionStatus;
  checksum: string;
  jobId: string;
  finalUrl: string;
}

async function resolveIncompleteReuseTarget(
  supabase: SupabaseClient,
  orgaoId: string,
  notebookId: string,
  checksum: string,
): Promise<string | null> {
  const incompleteRows = await findIncompleteFontesByChecksum(supabase, orgaoId, checksum);

  let reuseFonteId: string | null = null;

  for (const row of incompleteRows) {
    if (row.notebook_id === notebookId) {
      reuseFonteId = row.id;
      continue;
    }

    await purgeOrphanFonte(supabase, row.id, orgaoId);
  }

  return reuseFonteId;
}

export async function stageUrlSource(
  params: StageUrlSourceParams,
): Promise<StageUrlSourceResult> {
  const fetched = await fetchPublicUrlContent(params.sourceUrl);
  const checksum = computeChecksum(fetched.buffer);
  const titulo = params.titulo?.trim() || fetched.filename;

  if (!params.confirmChecksumDuplicate) {
    const checksumDuplicates = await findChecksumDuplicates(
      params.supabase,
      params.orgaoId,
      checksum,
    );

    if (checksumDuplicates.length > 0) {
      throw new DuplicateChecksumError(checksumDuplicates);
    }
  }

  const reuseFonteId = params.confirmChecksumDuplicate
    ? null
    : await resolveIncompleteReuseTarget(
        params.supabase,
        params.orgaoId,
        params.notebookId,
        checksum,
      );

  const storagePath = buildDocumentStorageKey(
    params.orgaoId,
    params.notebookId,
    fetched.filename,
  );
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'documentos';

  const { error: uploadError } = await params.supabase.storage
    .from(bucket)
    .upload(storagePath, fetched.buffer, {
      contentType: fetched.contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new UploadPipelineError('storage', uploadError);
  }

  if (reuseFonteId) {
    await resetFonteForReingestion({
      supabase: params.supabase,
      fonteId: reuseFonteId,
      orgaoId: params.orgaoId,
      notebookId: params.notebookId,
      titulo,
      checksum,
      caminhoArquivo: storagePath,
      mimeType: fetched.contentType,
      fileType: fetched.fileType,
      filename: fetched.filename,
      tipoOrigem: 'url',
      sourceUrl: params.sourceUrl.trim(),
      fetchedUrl: fetched.finalUrl,
      confirmChecksumDuplicate: params.confirmChecksumDuplicate,
      confirmSimilarContent: params.confirmSimilarContent,
      sigiloExceptionJustificativa: params.sigiloExceptionJustificativa,
    });

    invalidateNotebookRagCache(params.notebookId);

    return {
      fonteId: reuseFonteId,
      status: 'processando',
      checksum,
      jobId: reuseFonteId,
      finalUrl: fetched.finalUrl,
    };
  }

  const now = new Date().toISOString();
  const ingestionJob: IngestionJobState = {
    stage: 'enqueued',
    enqueued_at: now,
    updated_at: now,
    error: null,
  };

  const { data: fonte, error: fonteError } = await params.supabase
    .from('fonte')
    .insert({
      notebook_id: params.notebookId,
      tipo_origem: 'url',
      url: fetched.finalUrl,
      caminho_arquivo: storagePath,
      titulo,
      conteudo_texto: null,
      checksum,
      anonimizada: false,
      orgao_id: params.orgaoId,
      metadados_json: {
        status: 'processando' satisfies FonteIngestionStatus,
        mime_type: fetched.contentType,
        filename: fetched.filename,
        storage_filename: storagePath.split('/').pop(),
        file_type: fetched.fileType,
        source_url: params.sourceUrl.trim(),
        fetched_url: fetched.finalUrl,
        fetched_at: now,
        fetched_bytes: fetched.sizeBytes,
        ingestion_job: ingestionJob,
        dedup: {
          checksum_duplicate_confirmed: params.confirmChecksumDuplicate === true,
          similar_content_confirmed: params.confirmSimilarContent === true,
        },
        sigilo_exception_justificativa: params.sigiloExceptionJustificativa ?? null,
        pipeline: 'inngest',
      },
    })
    .select('id')
    .single();

  if (fonteError || !fonte) {
    throw new UploadPipelineError('fonte', fonteError ?? new Error('fonte insert failed'));
  }

  invalidateNotebookRagCache(params.notebookId);

  return {
    fonteId: fonte.id,
    status: 'processando',
    checksum,
    jobId: fonte.id,
    finalUrl: fetched.finalUrl,
  };
}

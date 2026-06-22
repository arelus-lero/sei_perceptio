import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { FonteIngestionStatus, IngestionJobState } from '@/types/ingestion';

function readIngestionStatus(
  metadados: Record<string, unknown> | null | undefined,
): FonteIngestionStatus {
  const raw = metadados?.status;
  if (
    raw === 'pronto'
    || raw === 'requer_ocr'
    || raw === 'erro'
    || raw === 'erro_embeddings'
    || raw === 'processando'
  ) {
    return raw;
  }

  return 'processando';
}

export async function countFonteChunksWithEmbedding(
  supabase: SupabaseClient,
  fonteId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('chunk')
    .select('id', { count: 'exact', head: true })
    .eq('fonte_id', fonteId)
    .not('embedding', 'is', null);

  if (error) {
    throw new Error(`Falha ao contar chunks da fonte ${fonteId}: ${error.message}`);
  }

  return count ?? 0;
}

export async function isFonteSuccessfullyIngested(
  supabase: SupabaseClient,
  fonteId: string,
  metadados: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  const status = readIngestionStatus(metadados);
  if (status === 'pronto' || status === 'requer_ocr') {
    return true;
  }

  const chunkCount = await countFonteChunksWithEmbedding(supabase, fonteId);
  return chunkCount > 0;
}

export async function deleteFonteChunks(
  supabase: SupabaseClient,
  fonteId: string,
  orgaoId: string,
): Promise<void> {
  const { error } = await supabase
    .from('chunk')
    .delete()
    .eq('fonte_id', fonteId)
    .eq('orgao_id', orgaoId);

  if (error) {
    throw new Error(`Falha ao remover chunks da fonte ${fonteId}: ${error.message}`);
  }
}

async function deleteStorageObject(
  supabase: SupabaseClient,
  storagePath: string | null | undefined,
): Promise<void> {
  if (!storagePath) {
    return;
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'documentos';
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);

  if (error) {
    console.warn(`[reprocess-fonte] falha ao remover objeto ${storagePath}: ${error.message}`);
  }
}

export async function purgeOrphanFonte(
  supabase: SupabaseClient,
  fonteId: string,
  orgaoId: string,
): Promise<void> {
  const { data: fonte, error: fetchError } = await supabase
    .from('fonte')
    .select('id, caminho_arquivo')
    .eq('id', fonteId)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Falha ao carregar fonte órfã ${fonteId}: ${fetchError.message}`);
  }

  if (!fonte) {
    return;
  }

  await deleteFonteChunks(supabase, fonteId, orgaoId);
  await deleteStorageObject(supabase, fonte.caminho_arquivo);

  const { error: deleteError } = await supabase
    .from('fonte')
    .delete()
    .eq('id', fonteId)
    .eq('orgao_id', orgaoId);

  if (deleteError) {
    throw new Error(`Falha ao remover fonte órfã ${fonteId}: ${deleteError.message}`);
  }
}

interface ResetFonteForReingestionParams {
  supabase: SupabaseClient;
  fonteId: string;
  orgaoId: string;
  notebookId: string;
  titulo: string;
  checksum: string;
  caminhoArquivo: string;
  mimeType: string;
  fileType: string;
  filename: string;
  tipoOrigem: 'upload' | 'url';
  sourceUrl?: string;
  fetchedUrl?: string;
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
  sigiloExceptionJustificativa?: string;
}

/**
 * Reutiliza o id da fonte incompleta (estratégia b): limpa chunks parciais,
 * atualiza metadados/storage e reinicia a ingestão no mesmo registro.
 */
export async function resetFonteForReingestion(
  params: ResetFonteForReingestionParams,
): Promise<void> {
  const { data: existing, error: fetchError } = await params.supabase
    .from('fonte')
    .select('id, caminho_arquivo, metadados_json')
    .eq('id', params.fonteId)
    .eq('orgao_id', params.orgaoId)
    .maybeSingle();

  if (fetchError || !existing) {
    throw new Error(`Fonte ${params.fonteId} não encontrada para reprocessamento`);
  }

  const previousPath = existing.caminho_arquivo;
  await deleteFonteChunks(params.supabase, params.fonteId, params.orgaoId);

  const now = new Date().toISOString();
  const ingestionJob: IngestionJobState = {
    stage: 'enqueued',
    enqueued_at: now,
    updated_at: now,
    error: null,
  };

  const previousMetadados =
    existing.metadados_json && typeof existing.metadados_json === 'object'
      ? (existing.metadados_json as Record<string, unknown>)
      : {};

  const metadadosJson: Record<string, unknown> = {
    ...previousMetadados,
    status: 'processando' satisfies FonteIngestionStatus,
    mime_type: params.mimeType,
    filename: params.filename,
    storage_filename: params.caminhoArquivo.split('/').pop(),
    file_type: params.fileType,
    ingestion_job: ingestionJob,
    dedup: {
      checksum_duplicate_confirmed: params.confirmChecksumDuplicate === true,
      similar_content_confirmed: params.confirmSimilarContent === true,
    },
    sigilo_exception_justificativa: params.sigiloExceptionJustificativa ?? null,
    pipeline: 'inline',
  };

  if (params.tipoOrigem === 'url') {
    metadadosJson.source_url = params.sourceUrl ?? null;
    metadadosJson.fetched_url = params.fetchedUrl ?? null;
    metadadosJson.fetched_at = now;
  }

  const { error: updateError } = await params.supabase
    .from('fonte')
    .update({
      notebook_id: params.notebookId,
      tipo_origem: params.tipoOrigem,
      titulo: params.titulo,
      checksum: params.checksum,
      caminho_arquivo: params.caminhoArquivo,
      url: params.tipoOrigem === 'url' ? params.fetchedUrl ?? params.sourceUrl ?? null : null,
      conteudo_texto: null,
      anonimizada: false,
      metadados_json: metadadosJson,
    })
    .eq('id', params.fonteId)
    .eq('orgao_id', params.orgaoId);

  if (updateError) {
    throw new Error(`Falha ao resetar fonte ${params.fonteId}: ${updateError.message}`);
  }

  if (previousPath && previousPath !== params.caminhoArquivo) {
    await deleteStorageObject(params.supabase, previousPath);
  }
}

export async function prepareFonteForReprocessing(
  supabase: SupabaseClient,
  fonteId: string,
  orgaoId: string,
): Promise<void> {
  const { data: fonte, error: fetchError } = await supabase
    .from('fonte')
    .select('metadados_json')
    .eq('id', fonteId)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (fetchError || !fonte) {
    throw new Error(`Fonte ${fonteId} não encontrada`);
  }

  await deleteFonteChunks(supabase, fonteId, orgaoId);

  const metadados =
    fonte.metadados_json && typeof fonte.metadados_json === 'object'
      ? (fonte.metadados_json as Record<string, unknown>)
      : {};

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('fonte')
    .update({
      conteudo_texto: null,
      anonimizada: false,
      metadados_json: {
        ...metadados,
        status: 'processando' satisfies FonteIngestionStatus,
        ingestion_job: {
          stage: 'enqueued',
          enqueued_at: now,
          updated_at: now,
          error: null,
        },
      },
    })
    .eq('id', fonteId)
    .eq('orgao_id', orgaoId);

  if (updateError) {
    throw new Error(`Falha ao preparar fonte ${fonteId} para reprocessamento: ${updateError.message}`);
  }
}

export function isReprocessableStatus(
  metadados: Record<string, unknown> | null | undefined,
): boolean {
  const status = readIngestionStatus(metadados);
  return status === 'erro' || status === 'erro_embeddings' || status === 'processando';
}

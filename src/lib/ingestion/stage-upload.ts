import 'server-only';

import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/db/schema';
import {
  findChecksumDuplicates,
  findIncompleteFontesByChecksum,
} from '@/lib/dedup/check-upload-duplicates';
import { DuplicateChecksumError } from '@/lib/dedup/dedup-errors';
import { resolveUploadFileType } from '@/lib/ingestion/file-type';
import {
  purgeOrphanFonte,
  resetFonteForReingestion,
} from '@/lib/ingestion/reprocess-fonte';
import { UploadPipelineError } from '@/lib/ingestion/upload-pipeline-error';
import { invalidateNotebookRagCache } from '@/lib/rag/query-cache';
import { buildDocumentStorageKey } from '@/lib/utils/storage-key';
import type { FonteIngestionStatus, IngestionJobState } from '@/types/ingestion';

export function computeChecksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

interface StageUploadFileParams {
  supabase: SupabaseClient;
  orgaoId: string;
  notebookId: string;
  file: File;
  titulo?: string;
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
  sigiloExceptionJustificativa?: string;
  userRole: UserRole | null;
}

export interface StageUploadFileResult {
  fonteId: string;
  status: FonteIngestionStatus;
  checksum: string;
  jobId: string;
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

export async function stageUploadFile(
  params: StageUploadFileParams,
): Promise<StageUploadFileResult> {
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const checksum = computeChecksum(buffer);
  const nomeOriginal = params.file.name;
  const titulo = params.titulo?.trim() || nomeOriginal;
  const fileType = resolveUploadFileType(nomeOriginal, params.file.type);

  if (!fileType) {
    throw new UploadPipelineError(
      'extraction',
      new Error(`Unsupported upload type for ${nomeOriginal}`),
      400,
    );
  }

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
    nomeOriginal,
  );
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'documentos';

  const { error: uploadError } = await params.supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: params.file.type || 'application/octet-stream',
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
      mimeType: params.file.type || 'application/octet-stream',
      fileType,
      filename: nomeOriginal,
      tipoOrigem: 'upload',
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
      tipo_origem: 'upload',
      caminho_arquivo: storagePath,
      titulo,
      conteudo_texto: null,
      checksum,
      anonimizada: false,
      orgao_id: params.orgaoId,
      metadados_json: {
        status: 'processando' satisfies FonteIngestionStatus,
        mime_type: params.file.type,
        filename: nomeOriginal,
        storage_filename: storagePath.split('/').pop(),
        file_type: fileType,
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
  };
}

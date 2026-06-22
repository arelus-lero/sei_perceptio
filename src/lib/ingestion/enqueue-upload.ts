import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/db/schema';
import { enqueueIngestionJob } from '@/lib/inngest/send-events';
import { stageUploadFile, type StageUploadFileResult } from '@/lib/ingestion/stage-upload';

interface EnqueueUploadedFileParams {
  supabase: SupabaseClient;
  orgaoId: string;
  notebookId: string;
  userRole: UserRole | null;
  file: File;
  titulo?: string;
  sigiloExceptionJustificativa?: string;
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
}

export async function enqueueUploadedFile(
  params: EnqueueUploadedFileParams,
): Promise<StageUploadFileResult> {
  const staged = await stageUploadFile({
    supabase: params.supabase,
    orgaoId: params.orgaoId,
    notebookId: params.notebookId,
    file: params.file,
    titulo: params.titulo,
    userRole: params.userRole,
    sigiloExceptionJustificativa: params.sigiloExceptionJustificativa,
    confirmChecksumDuplicate: params.confirmChecksumDuplicate,
    confirmSimilarContent: params.confirmSimilarContent,
  });

  await enqueueIngestionJob({
    fonteId: staged.fonteId,
    orgaoId: params.orgaoId,
    userRole: params.userRole,
    sigiloExceptionJustificativa: params.sigiloExceptionJustificativa,
    confirmChecksumDuplicate: params.confirmChecksumDuplicate,
    confirmSimilarContent: params.confirmSimilarContent,
  });

  return staged;
}

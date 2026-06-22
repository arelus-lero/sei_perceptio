import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/db/schema';
import { enqueueIngestionJob } from '@/lib/inngest/send-events';
import {
  stageUrlSource,
  type StageUrlSourceResult,
} from '@/lib/ingestion/stage-url-source';

interface EnqueueUrlSourceParams {
  supabase: SupabaseClient;
  orgaoId: string;
  notebookId: string;
  sourceUrl: string;
  userRole: UserRole | null;
  titulo?: string;
  sigiloExceptionJustificativa?: string;
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
}

export async function enqueueUrlSource(
  params: EnqueueUrlSourceParams,
): Promise<StageUrlSourceResult> {
  const staged = await stageUrlSource({
    supabase: params.supabase,
    orgaoId: params.orgaoId,
    notebookId: params.notebookId,
    sourceUrl: params.sourceUrl,
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

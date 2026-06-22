import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { inngest } from '@/lib/inngest/client';
import { createJobId } from '@/lib/inngest/job-tracker';
import { runEmbeddingReprocess, runIngestionPipeline } from '@/lib/ingestion/run-ingestion-pipeline';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserRole } from '@/lib/db/schema';

interface EnqueueIngestionParams {
  fonteId: string;
  orgaoId: string;
  userRole: UserRole | null;
  sigiloExceptionJustificativa?: string;
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
}

function isPlaceholderOrEmpty(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return true;
  }

  if (/^<.*>$/.test(trimmed)) {
    return true;
  }

  if (/^(your[-_]|changeme|placeholder|todo)/i.test(trimmed)) {
    return true;
  }

  return false;
}

function isInngestConfigured(): boolean {
  return !isPlaceholderOrEmpty(process.env.INNGEST_EVENT_KEY);
}

function isInngestDevEnabled(): boolean {
  if (isPlaceholderOrEmpty(process.env.INNGEST_DEV)) {
    return false;
  }

  const trimmed = process.env.INNGEST_DEV!.trim().toLowerCase();
  return trimmed === '1' || trimmed === 'true';
}

function usesInlineIngestion(): boolean {
  if (process.env.INGESTION_INLINE === 'true') {
    return true;
  }

  if (process.env.INGESTION_INLINE === 'false') {
    return false;
  }

  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  return !isInngestConfigured() || !isInngestDevEnabled();
}

async function ensureFonteNotStuckOnError(
  supabase: SupabaseClient,
  fonteId: string,
  orgaoId: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : 'Falha na ingestão inline';

  const { data: fonte } = await supabase
    .from('fonte')
    .select('id, metadados_json')
    .eq('id', fonteId)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (!fonte) {
    return;
  }

  const metadados = (fonte.metadados_json ?? {}) as Record<string, unknown>;
  if (metadados.status !== 'processando') {
    return;
  }

  const previousJob =
    metadados.ingestion_job && typeof metadados.ingestion_job === 'object'
      ? (metadados.ingestion_job as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase
    .from('fonte')
    .update({
      metadados_json: {
        ...metadados,
        status: 'erro',
        ingestion_job: {
          ...previousJob,
          stage: 'failed',
          error: message,
          updated_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', fonteId)
    .eq('orgao_id', orgaoId);

  if (updateError) {
    console.error(
      `[ingestion:inline] failed to mark fonte ${fonteId} as erro:`,
      updateError.message,
    );
  }
}

function scheduleInlineIngestionJob(params: EnqueueIngestionParams): void {
  const supabase = createAdminClient();

  void (async () => {
    try {
      const result = await runIngestionPipeline({
        supabase,
        fonteId: params.fonteId,
        orgaoId: params.orgaoId,
        userRole: params.userRole,
        sigiloExceptionJustificativa: params.sigiloExceptionJustificativa,
        confirmChecksumDuplicate: params.confirmChecksumDuplicate,
        confirmSimilarContent: params.confirmSimilarContent,
      });

      console.info(
        `[ingestion:inline] completed fonte=${params.fonteId} status=${result.status} chunks=${result.chunks_indexed}`,
      );
    } catch (error) {
      console.error(
        '[ingestion:inline] pipeline failed:',
        error instanceof Error ? error.stack : error,
      );
      await ensureFonteNotStuckOnError(supabase, params.fonteId, params.orgaoId, error);
    }
  })();
}

function scheduleInlineEmbeddingReprocessJob(params: {
  fonteId: string;
  orgaoId: string;
}): void {
  const supabase = createAdminClient();

  void (async () => {
    try {
      const result = await runEmbeddingReprocess({
        supabase,
        fonteId: params.fonteId,
        orgaoId: params.orgaoId,
      });

      console.info(
        `[ingestion:reembed:inline] completed fonte=${params.fonteId} status=${result.status} chunks=${result.chunks_indexed}`,
      );
    } catch (error) {
      console.error(
        '[ingestion:reembed:inline] failed:',
        error instanceof Error ? error.stack : error,
      );
      await ensureFonteNotStuckOnError(supabase, params.fonteId, params.orgaoId, error);
    }
  })();
}

export async function enqueueEmbeddingReprocessJob(params: {
  fonteId: string;
  orgaoId: string;
}): Promise<void> {
  if (usesInlineIngestion()) {
    scheduleInlineEmbeddingReprocessJob(params);
    return;
  }

  try {
    await inngest.send({
      name: 'ingestion/embed.requested',
      data: {
        fonteId: params.fonteId,
        orgaoId: params.orgaoId,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[ingestion:reembed] inngest.send failed; falling back to inline:',
        error instanceof Error ? error.message : error,
      );
      scheduleInlineEmbeddingReprocessJob(params);
      return;
    }

    throw error;
  }
}

export async function enqueueIngestionJob(
  params: EnqueueIngestionParams,
): Promise<void> {
  if (usesInlineIngestion()) {
    scheduleInlineIngestionJob(params);
    return;
  }

  try {
    await inngest.send({
      name: 'ingestion/process.requested',
      data: {
        fonteId: params.fonteId,
        orgaoId: params.orgaoId,
        userRole: params.userRole,
        sigiloExceptionJustificativa: params.sigiloExceptionJustificativa,
        confirmChecksumDuplicate: params.confirmChecksumDuplicate,
        confirmSimilarContent: params.confirmSimilarContent,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[ingestion] inngest.send failed in development; falling back to inline pipeline:',
        error instanceof Error ? error.message : error,
      );
      scheduleInlineIngestionJob(params);
      return;
    }

    throw error;
  }
}

interface EnqueueMonitoringCheckParams {
  orgaoId: string;
  userId: string;
  processoId?: string;
  nup?: string;
}

export async function enqueueMonitoringCheckJob(
  params: EnqueueMonitoringCheckParams,
): Promise<string> {
  const jobId = createJobId();

  await inngest.send({
    name: 'monitoring/check.requested',
    data: {
      jobId,
      orgaoId: params.orgaoId,
      userId: params.userId,
      processoId: params.processoId,
      nup: params.nup,
    },
  });

  return jobId;
}

interface EnqueueRetentionApplyParams {
  orgaoId: string;
  userId: string;
  dryRun?: boolean;
}

export async function enqueueRetentionApplyJob(
  params: EnqueueRetentionApplyParams,
): Promise<string> {
  const jobId = createJobId();

  await inngest.send({
    name: 'retention/apply.manual',
    data: {
      jobId,
      orgaoId: params.orgaoId,
      userId: params.userId,
      dryRun: params.dryRun,
      triggeredBy: params.userId,
    },
  });

  return jobId;
}

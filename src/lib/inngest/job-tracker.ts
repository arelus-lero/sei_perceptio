import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuditLogAcao } from '@/lib/db/schema';
import type { AsyncJobSnapshot, AsyncJobStatus, AsyncJobType } from '@/types/ingestion';

const JOB_ENTITY_TYPE = 'async_job';

interface RecordJobStatusInput {
  supabase: SupabaseClient;
  orgaoId: string;
  userId: string;
  jobId: string;
  jobType: AsyncJobType;
  status: AsyncJobStatus;
  result?: Record<string, unknown>;
  error?: string | null;
}

export async function recordAsyncJobStatus(
  input: RecordJobStatusInput,
): Promise<void> {
  const now = new Date().toISOString();
  const acao: AuditLogAcao =
    input.jobType === 'ingestion'
      ? 'ingestao'
      : input.jobType === 'retention'
        ? 'configuracao'
        : 'modificacao';

  const { error } = await input.supabase.from('audit_log').insert({
    orgao_id: input.orgaoId,
    usuario_id: input.userId,
    acao,
    entidade_tipo: JOB_ENTITY_TYPE,
    entidade_id: input.jobId,
    detalhes_json: {
      job_id: input.jobId,
      job_type: input.jobType,
      job_status: input.status,
      updated_at: now,
      result: input.result ?? null,
      error: input.error ?? null,
    },
  });

  if (error) {
    throw new Error(`Falha ao registrar status do job ${input.jobId}: ${error.message}`);
  }
}

export async function getAsyncJobStatus(
  supabase: SupabaseClient,
  orgaoId: string,
  jobId: string,
): Promise<AsyncJobSnapshot | null> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('detalhes_json, created_at')
    .eq('orgao_id', orgaoId)
    .eq('entidade_tipo', JOB_ENTITY_TYPE)
    .eq('entidade_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao consultar job ${jobId}: ${error.message}`);
  }

  if (!data?.detalhes_json || typeof data.detalhes_json !== 'object') {
    return null;
  }

  const detalhes = data.detalhes_json as Record<string, unknown>;
  const jobType = detalhes.job_type;
  const jobStatus = detalhes.job_status;

  if (
    jobType !== 'ingestion'
    && jobType !== 'monitoring'
    && jobType !== 'retention'
  ) {
    return null;
  }

  if (
    jobStatus !== 'enqueued'
    && jobStatus !== 'running'
    && jobStatus !== 'completed'
    && jobStatus !== 'failed'
  ) {
    return null;
  }

  const updatedAt =
    typeof detalhes.updated_at === 'string' ? detalhes.updated_at : data.created_at;

  return {
    job_id: jobId,
    job_type: jobType,
    status: jobStatus,
    created_at: data.created_at,
    updated_at: updatedAt,
    result:
      detalhes.result && typeof detalhes.result === 'object'
        ? (detalhes.result as Record<string, unknown>)
        : undefined,
    error: typeof detalhes.error === 'string' ? detalhes.error : null,
  };
}

export function createJobId(): string {
  return crypto.randomUUID();
}

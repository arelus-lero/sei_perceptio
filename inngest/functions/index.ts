import { runApplyRetentionJob } from '@/lib/governance/apply-retention';
import { resolveDryRun } from '@/lib/governance/retention-types';
import { inngest } from '@/lib/inngest/client';
import { recordAsyncJobStatus } from '@/lib/inngest/job-tracker';
import {
  runEmbeddingReprocess,
  runIngestionPipeline,
} from '@/lib/ingestion/run-ingestion-pipeline';
import { createRequestLogger } from '@/lib/logger';
import {
  checkAllMonitoredProcessos,
  checkProcessoChanges,
} from '@/lib/monitoring/check-processo';
import { dispatchMonitoringNotifications } from '@/lib/notifications/dispatch-monitoring-notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CheckProcessoResult } from '@/types/monitoring';

function collectAlertasFromResults(resultados: CheckProcessoResult[]) {
  return resultados.flatMap((result) => result.alertas);
}

async function executeRetentionJob(params: {
  dryRun?: boolean;
  trigger: 'cron' | 'manual';
  jobId?: string;
  orgaoId?: string;
  userId?: string;
}) {
  const dryRun = resolveDryRun(params.dryRun, process.env.RETENTION_DRY_RUN);
  const supabase = createAdminClient();
  const jobId = params.jobId ?? crypto.randomUUID();
  const log = createRequestLogger(jobId, {
    route: 'inngest/apply-retention',
    trigger: params.trigger,
  });

  if (params.orgaoId && params.userId) {
    await recordAsyncJobStatus({
      supabase,
      orgaoId: params.orgaoId,
      userId: params.userId,
      jobId,
      jobType: 'retention',
      status: 'running',
    });
  }

  try {
    const summary = await runApplyRetentionJob(supabase, { dryRun });

    if (params.orgaoId && params.userId) {
      await recordAsyncJobStatus({
        supabase,
        orgaoId: params.orgaoId,
        userId: params.userId,
        jobId,
        jobType: 'retention',
        status: 'completed',
        result: summary as unknown as Record<string, unknown>,
      });
    }

    log.info(
      {
        event: 'retention_job_completed',
        dry_run: summary.dry_run,
        politicas_processadas: summary.politicas_processadas,
        candidatos_encontrados: summary.candidatos_encontrados,
        acoes_executadas: summary.acoes_executadas,
        acoes_simuladas: summary.acoes_simuladas,
        acoes_ignoradas: summary.acoes_ignoradas,
      },
      'Retention job completed',
    );

    return { jobId, summary };
  } catch (error) {
    if (params.orgaoId && params.userId) {
      await recordAsyncJobStatus({
        supabase,
        orgaoId: params.orgaoId,
        userId: params.userId,
        jobId,
        jobType: 'retention',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Retention job failed',
      });
    }

    throw error;
  }
}

export const processIngestionJob = inngest.createFunction(
  {
    id: 'process-ingestion',
    retries: 2,
    idempotency: 'event.data.fonteId',
    triggers: { event: 'ingestion/process.requested' },
  },
  async ({ event, step }) => {
    return step.run('run-ingestion-pipeline', async () => {
      const supabase = createAdminClient();

      return runIngestionPipeline({
        supabase,
        fonteId: event.data.fonteId,
        orgaoId: event.data.orgaoId,
        userRole: event.data.userRole,
        sigiloExceptionJustificativa: event.data.sigiloExceptionJustificativa,
        confirmChecksumDuplicate: event.data.confirmChecksumDuplicate,
        confirmSimilarContent: event.data.confirmSimilarContent,
      });
    });
  },
);

export const reembedFonteJob = inngest.createFunction(
  {
    id: 'reembed-fonte',
    retries: 2,
    idempotency: 'event.data.fonteId',
    triggers: { event: 'ingestion/embed.requested' },
  },
  async ({ event, step }) => {
    return step.run('run-embedding-reprocess', async () => {
      const supabase = createAdminClient();

      return runEmbeddingReprocess({
        supabase,
        fonteId: event.data.fonteId,
        orgaoId: event.data.orgaoId,
      });
    });
  },
);

export const monitoringCheckScheduled = inngest.createFunction(
  {
    id: 'monitoring-check-scheduled',
    retries: 1,
    triggers: { cron: '0 * * * *' },
  },
  async ({ step }) => {
    const supabase = createAdminClient();

    const orgaos = await step.run('list-orgaos', async () => {
      const { data, error } = await supabase.from('orgao').select('id');

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).map((row) => row.id as string);
    });

    const summaries: Array<{ orgao_id: string; processos: number }> = [];

    for (const orgaoId of orgaos) {
      const result = await step.run(`monitoring-check-${orgaoId}`, async () => {
        const resultados = await checkAllMonitoredProcessos(supabase, orgaoId);
        const notificationSummary = await dispatchMonitoringNotifications(
          supabase,
          collectAlertasFromResults(resultados),
        );

        return {
          orgao_id: orgaoId,
          processos: resultados.length,
          notificationSummary,
        };
      });

      summaries.push({ orgao_id: orgaoId, processos: result.processos });
    }

    return summaries;
  },
);

export const monitoringCheckManual = inngest.createFunction(
  {
    id: 'monitoring-check-manual',
    retries: 1,
    idempotency: 'event.data.jobId',
    triggers: { event: 'monitoring/check.requested' },
  },
  async ({ event, step }) => {
    const supabase = createAdminClient();
    const { jobId, orgaoId, userId, processoId, nup } = event.data;

    await step.run('mark-job-running', async () => {
      await recordAsyncJobStatus({
        supabase,
        orgaoId,
        userId,
        jobId,
        jobType: 'monitoring',
        status: 'running',
      });
    });

    try {
      const checkResult = await step.run('execute-monitoring-check', async () => {
        if (processoId) {
          const single = await checkProcessoChanges({
            supabase,
            processoId,
            orgaoId,
          });
          return { resultados: [single] };
        }

        if (nup) {
          const { data: processo, error } = await supabase
            .from('processo')
            .select('id')
            .eq('nup', nup)
            .eq('orgao_id', orgaoId)
            .maybeSingle();

          if (error) {
            throw new Error(error.message);
          }

          if (!processo) {
            throw new Error(`Processo ${nup} não encontrado`);
          }

          const single = await checkProcessoChanges({
            supabase,
            processoId: processo.id,
            orgaoId,
          });

          return { resultados: [single] };
        }

        const resultados = await checkAllMonitoredProcessos(supabase, orgaoId);
        return { resultados };
      });

      const notificationSummary = await step.run('dispatch-external-notifications', async () =>
        dispatchMonitoringNotifications(
          supabase,
          collectAlertasFromResults(checkResult.resultados),
        ),
      );

      const result = {
        ...checkResult,
        notificationSummary,
      };

      await step.run('mark-job-completed', async () => {
        await recordAsyncJobStatus({
          supabase,
          orgaoId,
          userId,
          jobId,
          jobType: 'monitoring',
          status: 'completed',
          result: result as Record<string, unknown>,
        });
      });

      return { jobId, ...result };
    } catch (error) {
      await step.run('mark-job-failed', async () => {
        await recordAsyncJobStatus({
          supabase,
          orgaoId,
          userId,
          jobId,
          jobType: 'monitoring',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Monitoring check failed',
        });
      });

      throw error;
    }
  },
);

export const applyRetentionDaily = inngest.createFunction(
  {
    id: 'apply-retention-daily',
    retries: 2,
    idempotency: 'event.ts',
    triggers: { cron: '0 3 * * *' },
  },
  async ({ step }) => {
    return step.run('apply-retention-policies', async () =>
      executeRetentionJob({ trigger: 'cron' }),
    );
  },
);

export const applyRetentionManual = inngest.createFunction(
  {
    id: 'apply-retention-manual',
    retries: 1,
    idempotency: 'event.data.jobId',
    triggers: { event: 'retention/apply.manual' },
  },
  async ({ event, step }) => {
    return step.run('apply-retention-policies-manual', async () =>
      executeRetentionJob({
        trigger: 'manual',
        dryRun: event.data.dryRun,
        jobId: event.data.jobId,
        orgaoId: event.data.orgaoId,
        userId: event.data.userId,
      }),
    );
  },
);

export const inngestFunctions = [
  processIngestionJob,
  reembedFonteJob,
  monitoringCheckScheduled,
  monitoringCheckManual,
  applyRetentionDaily,
  applyRetentionManual,
];

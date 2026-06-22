import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { canRunMonitoringCheck } from '@/lib/auth/rbac';
import { recordAsyncJobStatus } from '@/lib/inngest/job-tracker';
import { enqueueMonitoringCheckJob } from '@/lib/inngest/send-events';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';
import { validarNup } from '@/lib/utils/nup';

const CheckSchema = z.object({
  nup: z.string().optional(),
  processo_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/monitoramento/check');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canRunMonitoringCheck(auth.role)) {
      return forbiddenResponse('Somente admin ou analista podem executar verificação em lote');
    }

    const body = await request.json().catch(() => ({}));
    const validated = CheckSchema.parse(body);

    if (validated.nup && !validarNup(validated.nup)) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'NUP inválido' }, { status: 400 }),
        requestId,
      );
    }

    if (validated.processo_id) {
      const { data: processo, error: processoError } = await auth.supabase
        .from('processo')
        .select('id')
        .eq('id', validated.processo_id)
        .eq('orgao_id', auth.orgaoId)
        .maybeSingle();

      if (processoError) {
        logError(log, 'POST /api/monitoramento/check processo error', processoError);
        return withRequestIdHeader(
          NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
          requestId,
        );
      }

      if (!processo) {
        return withRequestIdHeader(
          NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 }),
          requestId,
        );
      }
    }

    const jobId = await enqueueMonitoringCheckJob({
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      processoId: validated.processo_id,
      nup: validated.nup,
    });

    await recordAsyncJobStatus({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      jobId,
      jobType: 'monitoring',
      status: 'enqueued',
      result: {
        processo_id: validated.processo_id ?? null,
        nup: validated.nup ?? null,
      },
    });

    log.info({ event: 'monitoring_check_enqueued', job_id: jobId }, 'Monitoring check enqueued');

    return withRequestIdHeader(
      NextResponse.json(
        {
          job_id: jobId,
          status: 'enqueued',
          message: 'Verificação enfileirada. Consulte GET /api/jobs/{job_id}.',
        },
        { status: 202 },
      ),
      requestId,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withRequestIdHeader(
        NextResponse.json({ error: error.issues }, { status: 400 }),
        requestId,
      );
    }

    logError(log, 'POST /api/monitoramento/check error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

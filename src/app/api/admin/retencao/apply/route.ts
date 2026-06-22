import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireApiAuth, requireRole } from '@/lib/auth/api-context';
import { recordAsyncJobStatus } from '@/lib/inngest/job-tracker';
import { enqueueRetentionApplyJob } from '@/lib/inngest/send-events';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';

const ApplyRetentionSchema = z.object({
  dry_run: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/admin/retencao/apply');

  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(
      auth,
      ['admin'],
      'Somente administradores podem executar retenção',
    );
    if (roleError) {
      return roleError;
    }

    const body = await request.json().catch(() => ({}));
    const validated = ApplyRetentionSchema.parse(body);
    const jobId = await enqueueRetentionApplyJob({
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      dryRun: validated.dry_run,
    });

    await recordAsyncJobStatus({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      jobId,
      jobType: 'retention',
      status: 'enqueued',
    });

    log.info({ event: 'retention_job_enqueued', job_id: jobId }, 'Retention job enqueued');

    return withRequestIdHeader(
      NextResponse.json(
        {
          job_id: jobId,
          status: 'enqueued',
          message: 'Job de retenção enfileirado. Consulte GET /api/jobs/{job_id}.',
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

    logError(log, 'POST /api/admin/retencao/apply error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

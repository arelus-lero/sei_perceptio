import { NextRequest, NextResponse } from 'next/server';

import { getApiAuthContext, unauthorizedResponse } from '@/lib/auth/api-context';
import { getAsyncJobStatus } from '@/lib/inngest/job-tracker';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { requestId, log } = getRouteLogger(request, 'GET /api/jobs/[jobId]');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const { jobId } = await context.params;
    const job = await getAsyncJobStatus(auth.supabase, auth.orgaoId, jobId);

    if (!job) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'Job não encontrado' }, { status: 404 }),
        requestId,
      );
    }

    return withRequestIdHeader(NextResponse.json({ data: job }, { status: 200 }), requestId);
  } catch (error) {
    logError(log, 'GET /api/jobs/[jobId] error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

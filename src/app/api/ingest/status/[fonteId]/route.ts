import { NextRequest, NextResponse } from 'next/server';

import { getApiAuthContext, unauthorizedResponse } from '@/lib/auth/api-context';
import { getIngestionStatus } from '@/lib/ingestion/run-ingestion-pipeline';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';
import { assertNotebookAccess } from '@/lib/notebook/access';

interface RouteContext {
  params: Promise<{ fonteId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { requestId, log } = getRouteLogger(request, 'GET /api/ingest/status/[fonteId]');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const { fonteId } = await context.params;

    const { data: fonte, error: fonteError } = await auth.supabase
      .from('fonte')
      .select('id, notebook_id')
      .eq('id', fonteId)
      .eq('orgao_id', auth.orgaoId)
      .single();

    if (fonteError || !fonte) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 }),
        requestId,
      );
    }

    const access = await assertNotebookAccess({
      supabase: auth.supabase,
      notebookId: fonte.notebook_id,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'read',
    });

    if (!access) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 }),
        requestId,
      );
    }

    const status = await getIngestionStatus(auth.supabase, fonteId, auth.orgaoId);

    return withRequestIdHeader(NextResponse.json({ data: status }, { status: 200 }), requestId);
  } catch (error) {
    logError(log, 'GET /api/ingest/status/[fonteId] error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

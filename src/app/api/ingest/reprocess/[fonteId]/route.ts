import { NextRequest, NextResponse } from 'next/server';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { canUploadSources } from '@/lib/auth/rbac';
import { readIngestionStatus } from '@/lib/dedup/check-upload-duplicates';
import { enqueueIngestionJob } from '@/lib/inngest/send-events';
import { prepareFonteForReprocessing, isReprocessableStatus } from '@/lib/ingestion/reprocess-fonte';
import { assertNotebookAccess } from '@/lib/notebook/access';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';
import { invalidateNotebookRagCache } from '@/lib/rag/query-cache';

interface RouteContext {
  params: Promise<{ fonteId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/ingest/reprocess/[fonteId]');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canUploadSources(auth.role)) {
      return forbiddenResponse('Consultores não podem reprocessar fontes');
    }

    const { fonteId } = await context.params;

    const { data: fonte, error: fonteError } = await auth.supabase
      .from('fonte')
      .select('id, notebook_id, caminho_arquivo, metadados_json')
      .eq('id', fonteId)
      .eq('orgao_id', auth.orgaoId)
      .single();

    if (fonteError || !fonte) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 }),
        requestId,
      );
    }

    if (!fonte.caminho_arquivo) {
      return withRequestIdHeader(
        NextResponse.json(
          { error: 'Fonte sem arquivo no Storage; reenvie o arquivo original.' },
          { status: 422 },
        ),
        requestId,
      );
    }

    const metadados = (fonte.metadados_json ?? {}) as Record<string, unknown>;
    if (!isReprocessableStatus(metadados)) {
      const status = readIngestionStatus(metadados);
      return withRequestIdHeader(
        NextResponse.json(
          {
            error: `Fonte não pode ser reprocessada no status atual (${status}).`,
            status,
          },
          { status: 422 },
        ),
        requestId,
      );
    }

    const access = await assertNotebookAccess({
      supabase: auth.supabase,
      notebookId: fonte.notebook_id,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'edit',
    });

    if (!access) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'Sem permissão de edição neste notebook' }, { status: 403 }),
        requestId,
      );
    }

    await prepareFonteForReprocessing(auth.supabase, fonteId, auth.orgaoId);

    await enqueueIngestionJob({
      fonteId,
      orgaoId: auth.orgaoId,
      userRole: auth.role,
    });

    invalidateNotebookRagCache(fonte.notebook_id);

    log.info(
      { event: 'fonte_reprocess_enqueued', fonte_id: fonteId, notebook_id: fonte.notebook_id },
      'Fonte re-enqueued for ingestion',
    );

    return withRequestIdHeader(
      NextResponse.json(
        {
          fonte_id: fonteId,
          status: 'processando',
          message:
            'Reprocessamento iniciado. Consulte GET /api/ingest/status/{fonte_id} para acompanhar.',
        },
        { status: 202 },
      ),
      requestId,
    );
  } catch (error) {
    logError(log, 'POST /api/ingest/reprocess/[fonteId] error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

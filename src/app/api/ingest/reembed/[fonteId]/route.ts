import { NextRequest, NextResponse } from 'next/server';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { canUploadSources } from '@/lib/auth/rbac';
import { enqueueEmbeddingReprocessJob } from '@/lib/inngest/send-events';
import {
  isEmbeddingDegradedStatus,
  readFonteIngestionStatus,
  readIngestionJob,
} from '@/lib/ingestion/ingestion-status';
import { countFonteChunksWithEmbedding } from '@/lib/ingestion/reprocess-fonte';
import { assertNotebookAccess } from '@/lib/notebook/access';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';
import { invalidateNotebookRagCache } from '@/lib/rag/query-cache';

interface RouteContext {
  params: Promise<{ fonteId: string }>;
}

async function isReembedableFonte(
  supabase: NonNullable<Awaited<ReturnType<typeof getApiAuthContext>>>['supabase'],
  fonteId: string,
  metadados: Record<string, unknown>,
): Promise<boolean> {
  const status = readFonteIngestionStatus(metadados);

  if (isEmbeddingDegradedStatus(status)) {
    return true;
  }

  const job = readIngestionJob(metadados);
  if (status === 'pronto' && job?.embedding_available === false) {
    return true;
  }

  if (status === 'pronto') {
    const embeddedCount = await countFonteChunksWithEmbedding(supabase, fonteId);
    return embeddedCount === 0;
  }

  return false;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/ingest/reembed/[fonteId]');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canUploadSources(auth.role)) {
      return forbiddenResponse('Consultores não podem reprocessar embeddings');
    }

    const { fonteId } = await context.params;

    const { data: fonte, error: fonteError } = await auth.supabase
      .from('fonte')
      .select('id, notebook_id, conteudo_texto, metadados_json')
      .eq('id', fonteId)
      .eq('orgao_id', auth.orgaoId)
      .single();

    if (fonteError || !fonte) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 }),
        requestId,
      );
    }

    if (!fonte.conteudo_texto?.trim()) {
      return withRequestIdHeader(
        NextResponse.json(
          { error: 'Fonte sem texto extraído; use reprocessamento completo.' },
          { status: 422 },
        ),
        requestId,
      );
    }

    const metadados = (fonte.metadados_json ?? {}) as Record<string, unknown>;

    if (!(await isReembedableFonte(auth.supabase, fonteId, metadados))) {
      const status = readFonteIngestionStatus(metadados);
      return withRequestIdHeader(
        NextResponse.json(
          {
            error: `Fonte não elegível para re-embed no status atual (${status}).`,
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

    await enqueueEmbeddingReprocessJob({
      fonteId,
      orgaoId: auth.orgaoId,
    });

    invalidateNotebookRagCache(fonte.notebook_id);

    log.info(
      { event: 'fonte_reembed_enqueued', fonte_id: fonteId, notebook_id: fonte.notebook_id },
      'Fonte re-enqueued for embedding reprocess',
    );

    return withRequestIdHeader(
      NextResponse.json(
        {
          fonte_id: fonteId,
          status: 'processando',
          message:
            'Reprocessamento de embeddings iniciado. Consulte GET /api/ingest/status/{fonte_id}.',
        },
        { status: 202 },
      ),
      requestId,
    );
  } catch (error) {
    logError(log, 'POST /api/ingest/reembed/[fonteId] error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

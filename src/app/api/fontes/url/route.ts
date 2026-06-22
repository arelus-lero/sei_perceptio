import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { canUploadSources } from '@/lib/auth/rbac';
import { parseUploadConfirmationFlag } from '@/lib/dedup/check-upload-duplicates';
import { assertCanAddFonte } from '@/lib/governance/org-limits';
import { logAuditSafe } from '@/lib/governance/audit-log';
import { enqueueUrlSource } from '@/lib/ingestion/enqueue-url-source';
import { handleUploadRouteError } from '@/lib/ingestion/handle-upload-route-error';
import { parsePublicHttpUrl, UrlFetchError } from '@/lib/ingestion/url-fetch';
import { assertNotebookAccess } from '@/lib/notebook/access';
import { getRouteLogger, withRequestIdHeader } from '@/lib/logger';

const RequestSchema = z.object({
  notebook_id: z.uuid(),
  url: z.string().min(8).max(2048),
  titulo: z.string().min(1).max(200).optional(),
  sigilo_exception_justificativa: z.string().max(2000).optional(),
  confirm_checksum_duplicate: z.boolean().optional(),
  confirm_similar_content: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/fontes/url');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canUploadSources(auth.role)) {
      return forbiddenResponse('Consultores não podem importar fontes via URL');
    }

    const body = await request.json();
    const validated = RequestSchema.parse(body);

    try {
      parsePublicHttpUrl(validated.url);
    } catch (error) {
      if (error instanceof UrlFetchError) {
        return withRequestIdHeader(
          NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus }),
          requestId,
        );
      }
      throw error;
    }

    const access = await assertNotebookAccess({
      supabase: auth.supabase,
      notebookId: validated.notebook_id,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'edit',
    });

    if (!access) {
      return withRequestIdHeader(
        NextResponse.json(
          { error: 'Sem permissão de edição neste notebook' },
          { status: 403 },
        ),
        requestId,
      );
    }

    await assertCanAddFonte(auth.supabase, auth.orgaoId, validated.notebook_id);

    const result = await enqueueUrlSource({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      notebookId: validated.notebook_id,
      sourceUrl: validated.url,
      titulo: validated.titulo,
      userRole: auth.role,
      sigiloExceptionJustificativa: validated.sigilo_exception_justificativa,
      confirmChecksumDuplicate: validated.confirm_checksum_duplicate,
      confirmSimilarContent: validated.confirm_similar_content,
    });

    log.info(
      {
        event: 'url_ingest_enqueued',
        fonte_id: result.fonteId,
        job_id: result.jobId,
        notebook_id: validated.notebook_id,
        source_url: validated.url,
        fetched_url: result.finalUrl,
        checksum: result.checksum,
      },
      'URL source enqueued for async ingestion',
    );

    await logAuditSafe({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      usuarioId: auth.user.id,
      acao: 'ingestao',
      entidadeTipo: 'fonte',
      entidadeId: result.fonteId,
      detalhes: {
        notebook_id: validated.notebook_id,
        titulo: validated.titulo ?? validated.url,
        source_url: validated.url,
        fetched_url: result.finalUrl,
        checksum: result.checksum,
        tipo_origem: 'url',
        status: result.status,
        async: true,
        job_id: result.jobId,
      },
      request,
    });

    return withRequestIdHeader(
      NextResponse.json(
        {
          fonte_id: result.fonteId,
          job_id: result.jobId,
          status: result.status,
          checksum: result.checksum,
          fetched_url: result.finalUrl,
          message:
            'URL recebida. A ingestão continua em background. Consulte GET /api/ingest/status/{fonte_id}.',
        },
        { status: 202 },
      ),
      requestId,
    );
  } catch (error) {
    return withRequestIdHeader(
      handleUploadRouteError(error, log, 'POST /api/fontes/url'),
      requestId,
    );
  }
}

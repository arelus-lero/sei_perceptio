import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { canUploadSources } from '@/lib/auth/rbac';
import {
  formatUnsupportedTypeMessage,
  resolveUploadFileType,
} from '@/lib/ingestion/file-type';
import { assertNotebookAccess } from '@/lib/notebook/access';
import {
  assertCanAddFonte,
} from '@/lib/governance/org-limits';
import { parseUploadConfirmationFlag } from '@/lib/dedup/check-upload-duplicates';
import { handleUploadRouteError } from '@/lib/ingestion/handle-upload-route-error';
import { enqueueUploadedFile } from '@/lib/ingestion/enqueue-upload';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';
import { mapTagRow } from '@/lib/tags/helpers';
import type { TagItem } from '@/types/tag';

const MAX_FILE_SIZE_BYTES = 524_288_000;

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function assertNotebookWritable(
  auth: NonNullable<Awaited<ReturnType<typeof getApiAuthContext>>>,
  notebookId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const access = await assertNotebookAccess({
    supabase: auth.supabase,
    notebookId,
    orgaoId: auth.orgaoId,
    userId: auth.user.id,
    userRole: auth.role,
    require: 'edit',
  });

  if (!access) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sem permissão de edição neste notebook' },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { requestId, log } = getRouteLogger(request, 'GET /api/notebooks/[id]/sources');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const { id: notebookId } = await context.params;

    const access = await assertNotebookAccess({
      supabase: auth.supabase,
      notebookId,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'read',
    });

    if (!access) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    const { data: fontes, error } = await auth.supabase
      .from('fonte')
      .select(
        `
        id,
        titulo,
        ativa,
        tipo_origem,
        checksum,
        metadados_json,
        created_at,
        fonte_tag (
          tag:tag_id (
            id,
            nome,
            cor,
            created_at
          )
        )
      `,
      )
      .eq('notebook_id', notebookId)
      .order('created_at', { ascending: true });

    if (error) {
      logError(log, 'GET /api/notebooks/[id]/sources error', error);
      return withRequestIdHeader(
        NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
        requestId,
      );
    }

    const mapped = (fontes ?? []).map((fonte) => {
      const tagRows = fonte.fonte_tag as unknown as Array<{ tag: TagItem | null }> | null;
      const tags = (tagRows ?? [])
        .map((row) => row.tag)
        .filter((tag): tag is TagItem => Boolean(tag))
        .map((tag) => mapTagRow(tag));

      return {
        id: fonte.id,
        titulo: fonte.titulo,
        ativa: fonte.ativa,
        tipo_origem: fonte.tipo_origem,
        checksum: fonte.checksum,
        metadados_json: fonte.metadados_json,
        created_at: fonte.created_at,
        tags,
      };
    });

    return withRequestIdHeader(
      NextResponse.json({ fontes: mapped }, { status: 200 }),
      requestId,
    );
  } catch (error) {
    logError(log, 'GET /api/notebooks/[id]/sources error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/notebooks/[id]/sources');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canUploadSources(auth.role)) {
      return forbiddenResponse('Consultores não podem enviar fontes');
    }

    const { id: notebookId } = await context.params;
    const access = await assertNotebookWritable(auth, notebookId);
    if (!access.ok) {
      return access.response;
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: 'Campo file é obrigatório' }, { status: 400 });
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo excede o limite de 500 MB' },
        { status: 400 },
      );
    }

    const fileType = resolveUploadFileType(fileEntry.name, fileEntry.type);
    if (!fileType) {
      return NextResponse.json(
        { error: formatUnsupportedTypeMessage(fileEntry.name, fileEntry.type) },
        { status: 400 },
      );
    }

    const tituloEntry = formData.get('titulo');
    const titulo =
      typeof tituloEntry === 'string' && tituloEntry.trim().length > 0
        ? tituloEntry.trim()
        : undefined;

    const justificativaEntry = formData.get('sigilo_exception_justificativa');
    const sigiloExceptionJustificativa =
      typeof justificativaEntry === 'string' ? justificativaEntry : undefined;

    const confirmChecksumDuplicate = parseUploadConfirmationFlag(
      formData.get('confirm_checksum_duplicate'),
    );
    const confirmSimilarContent = parseUploadConfirmationFlag(
      formData.get('confirm_similar_content'),
    );

    await assertCanAddFonte(auth.supabase, auth.orgaoId, notebookId);

    const result = await enqueueUploadedFile({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      notebookId,
      userRole: auth.role,
      file: fileEntry,
      titulo,
      sigiloExceptionJustificativa,
      confirmChecksumDuplicate,
      confirmSimilarContent,
    });

    return withRequestIdHeader(
      NextResponse.json(
        {
          fonte_id: result.fonteId,
          job_id: result.jobId,
          status: result.status,
          checksum: result.checksum,
          message:
            'Upload recebido. A ingestão continua em background. Consulte GET /api/ingest/status/{fonte_id}.',
        },
        { status: 202 },
      ),
      requestId,
    );
  } catch (error) {
    return withRequestIdHeader(
      handleUploadRouteError(error, log, 'POST /api/notebooks/[id]/sources'),
      requestId,
    );
  }
}

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
import { logAuditSafe } from '@/lib/governance/audit-log';
import { assertCanAddFonte } from '@/lib/governance/org-limits';
import { parseUploadConfirmationFlag } from '@/lib/dedup/check-upload-duplicates';
import { enqueueUploadedFile } from '@/lib/ingestion/enqueue-upload';
import { handleUploadRouteError } from '@/lib/ingestion/handle-upload-route-error';
import { getRouteLogger, withRequestIdHeader } from '@/lib/logger';

const MAX_FILE_SIZE_BYTES = 524_288_000;

export async function POST(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/ingest/upload');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canUploadSources(auth.role)) {
      return forbiddenResponse('Consultores não podem enviar fontes');
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const notebookIdEntry = formData.get('notebook_id');

    if (!(fileEntry instanceof File)) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'Campo file é obrigatório' }, { status: 400 }),
        requestId,
      );
    }

    if (typeof notebookIdEntry !== 'string' || !z.uuid().safeParse(notebookIdEntry).success) {
      return withRequestIdHeader(
        NextResponse.json({ error: 'notebook_id inválido' }, { status: 400 }),
        requestId,
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return withRequestIdHeader(
        NextResponse.json(
          { error: 'Arquivo excede o limite de 500 MB' },
          { status: 400 },
        ),
        requestId,
      );
    }

    const fileType = resolveUploadFileType(fileEntry.name, fileEntry.type);
    if (!fileType) {
      return withRequestIdHeader(
        NextResponse.json(
          { error: formatUnsupportedTypeMessage(fileEntry.name, fileEntry.type) },
          { status: 400 },
        ),
        requestId,
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

    await assertCanAddFonte(auth.supabase, auth.orgaoId, notebookIdEntry);

    const result = await enqueueUploadedFile({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      notebookId: notebookIdEntry,
      userRole: auth.role,
      file: fileEntry,
      titulo,
      sigiloExceptionJustificativa,
      confirmChecksumDuplicate,
      confirmSimilarContent,
    });

    log.info(
      {
        event: 'ingest_upload_enqueued',
        fonte_id: result.fonteId,
        job_id: result.jobId,
        notebook_id: notebookIdEntry,
        checksum: result.checksum,
      },
      'Upload enqueued for async ingestion',
    );

    await logAuditSafe({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      usuarioId: auth.user.id,
      acao: 'ingestao',
      entidadeTipo: 'fonte',
      entidadeId: result.fonteId,
      detalhes: {
        notebook_id: notebookIdEntry,
        titulo: titulo ?? fileEntry.name,
        checksum: result.checksum,
        mime: fileEntry.type,
        tamanho_bytes: fileEntry.size,
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
          message:
            'Upload recebido. A ingestão continua em background. Consulte GET /api/ingest/status/{fonte_id}.',
        },
        { status: 202 },
      ),
      requestId,
    );
  } catch (error) {
    return withRequestIdHeader(
      handleUploadRouteError(error, log, 'POST /api/ingest/upload'),
      requestId,
    );
  }
}

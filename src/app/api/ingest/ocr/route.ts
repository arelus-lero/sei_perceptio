import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { canUploadSources } from '@/lib/auth/rbac';
import { extractDocumentText } from '@/lib/ingestion/document-text-extractor';
import { getDefaultMaxOcrPages } from '@/lib/ingestion/pdf-text';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 524_288_000;

export async function POST(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/ingest/ocr');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canUploadSources(auth.role)) {
      return forbiddenResponse('Consultores não podem executar OCR');
    }

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const fileEntry = formData.get('file');
      const forceOcrEntry = formData.get('force_ocr');

      if (!(fileEntry instanceof File)) {
        return withRequestIdHeader(
          NextResponse.json({ error: 'Campo file é obrigatório' }, { status: 400 }),
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

      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      const forceOcr = forceOcrEntry === 'true' || forceOcrEntry === '1';

      const result = await extractDocumentText(buffer, fileEntry.name, {
        forceOcr,
        maxPages: getDefaultMaxOcrPages(),
      });

      log.info(
        {
          event: 'ingest_ocr_completed',
          filename: fileEntry.name,
          method: result.method,
          requires_ocr: result.requires_ocr,
        },
        'OCR extraction completed',
      );

      return withRequestIdHeader(
        NextResponse.json({ data: result }, { status: 200 }),
        requestId,
      );
    }

    const OcrJsonSchema = z.object({
      filename: z.string().min(1).max(255),
      content_base64: z.string().min(1),
      force_ocr: z.boolean().optional(),
      max_pages: z.number().int().positive().max(500).optional(),
    });

    const body = await request.json();
    const validated = OcrJsonSchema.parse(body);
    const buffer = Buffer.from(validated.content_base64, 'base64');

    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      return withRequestIdHeader(
        NextResponse.json(
          { error: 'Arquivo excede o limite de 500 MB' },
          { status: 400 },
        ),
        requestId,
      );
    }

    const result = await extractDocumentText(buffer, validated.filename, {
      forceOcr: validated.force_ocr,
      maxPages: validated.max_pages,
    });

    log.info(
      {
        event: 'ingest_ocr_completed',
        filename: validated.filename,
        method: result.method,
        requires_ocr: result.requires_ocr,
      },
      'OCR extraction completed',
    );

    return withRequestIdHeader(
      NextResponse.json({ data: result }, { status: 200 }),
      requestId,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withRequestIdHeader(
        NextResponse.json({ error: error.issues }, { status: 400 }),
        requestId,
      );
    }

    logError(log, 'POST /api/ingest/ocr error', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return withRequestIdHeader(
      NextResponse.json({ error: message }, { status: 500 }),
      requestId,
    );
  }
}

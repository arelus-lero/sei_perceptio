import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getApiAuthContext, unauthorizedResponse } from '@/lib/auth/api-context';
import { anonymizeText } from '@/lib/ingestion/anonymizer';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';

const PiiTypeSchema = z.enum([
  'CPF',
  'CNPJ',
  'EMAIL',
  'TELEFONE',
  'ENDERECO',
  'DADOS_BANCARIOS',
  'DADOS_SENSIVEIS',
]);

const AnonymizeRequestSchema = z.object({
  texto: z.string().min(1).max(500_000),
  mode: z.enum(['mask', 'redact', 'remove']).optional(),
  pii_types: z.array(PiiTypeSchema).optional(),
});

export async function POST(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/ingest/anonymize');

  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const validated = AnonymizeRequestSchema.parse(body);

    const result = await anonymizeText({
      texto: validated.texto,
      mode: validated.mode,
      piiTypes: validated.pii_types,
    });

    log.info(
      {
        event: 'ingest_anonymize_completed',
        anonymized: result.anonymized,
        mode: validated.mode ?? 'default',
      },
      'Text anonymization completed',
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

    logError(log, 'POST /api/ingest/anonymize error', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return withRequestIdHeader(
      NextResponse.json({ error: message }, { status: 500 }),
      requestId,
    );
  }
}

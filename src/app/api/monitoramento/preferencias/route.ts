import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import {
  getOrCreateNotificacaoPreferencia,
  updateNotificacaoPreferencia,
} from '@/lib/notifications/preferences';
import { MONITORING_EVENT_TYPES } from '@/types/notifications';

const EventPreferencesPatchSchema = z
  .object(
    Object.fromEntries(MONITORING_EVENT_TYPES.map((eventType) => [eventType, z.boolean()])),
  )
  .partial();

const PatchPreferenciasSchema = z.object({
  email_eventos: EventPreferencesPatchSchema.optional(),
  webhook_eventos: EventPreferencesPatchSchema.optional(),
  webhook_url: z.string().url().nullable().optional(),
  webhook_secret: z.string().min(16).nullable().optional(),
});

function maskWebhookSecret(secret: string | null): string | null {
  if (!secret) {
    return null;
  }

  if (secret.length <= 8) {
    return '********';
  }

  return `${secret.slice(0, 4)}…${secret.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const preferencia = await getOrCreateNotificacaoPreferencia(
      auth.supabase,
      auth.user.id,
      auth.orgaoId,
    );

    return NextResponse.json(
      {
        data: {
          ...preferencia,
          webhook_secret: maskWebhookSecret(preferencia.webhook_secret),
          webhook_secret_configured: Boolean(preferencia.webhook_secret),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('GET /api/monitoramento/preferencias error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const validated = PatchPreferenciasSchema.parse(body);

    const preferencia = await updateNotificacaoPreferencia(
      auth.supabase,
      auth.user.id,
      auth.orgaoId,
      validated,
    );

    return NextResponse.json(
      {
        data: {
          ...preferencia,
          webhook_secret: maskWebhookSecret(preferencia.webhook_secret),
          webhook_secret_configured: Boolean(preferencia.webhook_secret),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('PATCH /api/monitoramento/preferencias error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

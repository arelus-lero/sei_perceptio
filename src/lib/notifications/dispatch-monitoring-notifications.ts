import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { sendEmailNotification } from '@/lib/notifications/channels/email-channel';
import { sendWebhookNotification } from '@/lib/notifications/channels/webhook-channel';
import {
  getNotificacaoPreferencia,
  isEventEnabledForChannel,
} from '@/lib/notifications/preferences';
import { createRequestLogger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CreatedAlerta } from '@/types/monitoring';
import type { DispatchMonitoringSummary, MonitoringNotificationPayload } from '@/types/notifications';

async function resolveUserEmail(usuarioId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(usuarioId);

  if (error || !data.user?.email) {
    return null;
  }

  return data.user.email;
}

async function buildNotificationPayloads(
  supabase: SupabaseClient,
  alertas: CreatedAlerta[],
): Promise<MonitoringNotificationPayload[]> {
  if (alertas.length === 0) {
    return [];
  }

  const monitoramentoIds = [...new Set(alertas.map((alerta) => alerta.monitoramento_id))];
  const processoIds = [...new Set(alertas.map((alerta) => alerta.processo_id))];

  const [{ data: monitoramentos, error: monitoramentoError }, { data: processos, error: processoError }] =
    await Promise.all([
      supabase
        .from('monitoramento')
        .select('id, usuario_id')
        .in('id', monitoramentoIds),
      supabase.from('processo').select('id, nup').in('id', processoIds),
    ]);

  if (monitoramentoError) {
    throw new Error(monitoramentoError.message);
  }

  if (processoError) {
    throw new Error(processoError.message);
  }

  const monitoramentoById = new Map(
    (monitoramentos ?? []).map((row) => [row.id as string, row.usuario_id as string]),
  );
  const nupByProcessoId = new Map(
    (processos ?? []).map((row) => [row.id as string, row.nup as string]),
  );

  const usuarioIds = [
    ...new Set(
      alertas
        .map((alerta) => monitoramentoById.get(alerta.monitoramento_id))
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const emailByUserId = new Map<string, string | null>();

  await Promise.all(
    usuarioIds.map(async (usuarioId) => {
      emailByUserId.set(usuarioId, await resolveUserEmail(usuarioId));
    }),
  );

  return alertas.flatMap((alerta) => {
    const usuarioId = monitoramentoById.get(alerta.monitoramento_id);

    if (!usuarioId) {
      return [];
    }

    const nup = nupByProcessoId.get(alerta.processo_id) ?? 'N/A';

    return [
      {
        alerta_id: alerta.id,
        tipo_evento: alerta.tipo_evento,
        processo_id: alerta.processo_id,
        nup,
        descricao: alerta.descricao,
        monitoramento_id: alerta.monitoramento_id,
        orgao_id: alerta.orgao_id,
        usuario_id: usuarioId,
        usuario_email: emailByUserId.get(usuarioId) ?? null,
        created_at: alerta.data_criacao,
      },
    ];
  });
}

export async function dispatchMonitoringNotifications(
  supabase: SupabaseClient,
  alertas: CreatedAlerta[],
): Promise<DispatchMonitoringSummary> {
  const log = createRequestLogger(crypto.randomUUID(), {
    route: 'notifications/dispatch-monitoring',
  });

  const summary: DispatchMonitoringSummary = {
    alertas_processados: alertas.length,
    email_enviados: 0,
    email_falhas: 0,
    webhook_enviados: 0,
    webhook_falhas: 0,
  };

  if (alertas.length === 0) {
    return summary;
  }

  const payloads = await buildNotificationPayloads(supabase, alertas);
  const preferenciasCache = new Map<string, Awaited<ReturnType<typeof getNotificacaoPreferencia>>>();

  for (const payload of payloads) {
    const cacheKey = `${payload.usuario_id}:${payload.orgao_id}`;

    if (!preferenciasCache.has(cacheKey)) {
      preferenciasCache.set(
        cacheKey,
        await getNotificacaoPreferencia(supabase, payload.usuario_id, payload.orgao_id),
      );
    }

    const preferencia = preferenciasCache.get(cacheKey);

    if (!preferencia) {
      continue;
    }

    if (
      isEventEnabledForChannel(preferencia, 'email', payload.tipo_evento)
      && payload.usuario_email
    ) {
      const emailResult = await sendEmailNotification({
        to: payload.usuario_email,
        payload,
      });

      if (emailResult.success) {
        summary.email_enviados += 1;
      } else {
        summary.email_falhas += 1;
      }
    }

    if (
      isEventEnabledForChannel(preferencia, 'webhook', payload.tipo_evento)
      && preferencia.webhook_url
      && preferencia.webhook_secret
    ) {
      const webhookResult = await sendWebhookNotification({
        url: preferencia.webhook_url,
        secret: preferencia.webhook_secret,
        payload,
      });

      if (webhookResult.success) {
        summary.webhook_enviados += 1;
      } else {
        summary.webhook_falhas += 1;
      }
    }
  }

  log.info(
    {
      event: 'monitoring_notifications_dispatched',
      ...summary,
    },
    'External monitoring notifications processed',
  );

  return summary;
}

import 'server-only';

import { createHmac } from 'node:crypto';

import { createRequestLogger } from '@/lib/logger';
import {
  MONITORING_EVENT_LABELS,
  type MonitoringNotificationPayload,
} from '@/types/notifications';

const WEBHOOK_SIGNATURE_HEADER = 'x-sei-perceptio-signature';
const WEBHOOK_TIMESTAMP_HEADER = 'x-sei-perceptio-timestamp';
const WEBHOOK_TIMEOUT_MS = 10_000;

export interface WebhookChannelInput {
  url: string;
  secret: string;
  payload: MonitoringNotificationPayload;
}

export interface WebhookChannelResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  return `sha256=${digest}`;
}

export async function sendWebhookNotification(
  input: WebhookChannelInput,
): Promise<WebhookChannelResult> {
  const log = createRequestLogger(input.payload.alerta_id, {
    route: 'notifications/webhook',
    usuario_id: input.payload.usuario_id,
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event: input.payload.tipo_evento,
    event_label: MONITORING_EVENT_LABELS[input.payload.tipo_evento],
    alerta_id: input.payload.alerta_id,
    monitoramento_id: input.payload.monitoramento_id,
    processo_id: input.payload.processo_id,
    nup: input.payload.nup,
    descricao: input.payload.descricao,
    orgao_id: input.payload.orgao_id,
    usuario_id: input.payload.usuario_id,
    created_at: input.payload.created_at,
  });

  const signature = signWebhookPayload(input.secret, timestamp, body);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(input.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [WEBHOOK_SIGNATURE_HEADER]: signature,
        [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
        'User-Agent': 'SEI-Perceptio-Webhook/1.0',
      },
      body,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      log.warn(
        {
          event: 'webhook_dispatch_failed',
          status: response.status,
          response_preview: responseBody.slice(0, 200),
        },
        'Webhook notification failed',
      );

      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    log.info({ event: 'webhook_dispatch_success' }, 'Webhook notification sent');
    return { success: true, statusCode: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook request failed';
    log.warn({ event: 'webhook_dispatch_error', err: error }, message);
    return { success: false, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

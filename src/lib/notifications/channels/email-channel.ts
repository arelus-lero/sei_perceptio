import 'server-only';

import { createRequestLogger } from '@/lib/logger';
import {
  MONITORING_EVENT_LABELS,
  type MonitoringNotificationPayload,
} from '@/types/notifications';

type EmailProvider = 'resend' | 'smtp';

interface EmailChannelInput {
  to: string;
  payload: MonitoringNotificationPayload;
}

export interface EmailChannelResult {
  success: boolean;
  provider?: EmailProvider;
  error?: string;
}

function resolveEmailProvider(): EmailProvider | null {
  const configured = (process.env.NOTIFICATION_EMAIL_PROVIDER ?? 'resend').toLowerCase();

  if (configured === 'smtp') {
    if (
      process.env.SMTP_HOST
      && process.env.SMTP_PORT
      && process.env.NOTIFICATION_FROM_EMAIL
    ) {
      return 'smtp';
    }
    return null;
  }

  if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL) {
    return 'resend';
  }

  return null;
}

function buildEmailContent(payload: MonitoringNotificationPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const eventLabel = MONITORING_EVENT_LABELS[payload.tipo_evento];
  const subject = `[SEI-Perceptio] ${eventLabel} — ${payload.nup}`;

  const text = [
    'SEI-Perceptio — Alerta de monitoramento',
    '',
    `Evento: ${eventLabel}`,
    `Processo (NUP): ${payload.nup}`,
    `Descrição: ${payload.descricao}`,
    `Data: ${payload.created_at}`,
    '',
    'Acesse o painel de monitoramento para mais detalhes.',
  ].join('\n');

  const html = `
    <h2>SEI-Perceptio — Alerta de monitoramento</h2>
    <p><strong>Evento:</strong> ${eventLabel}</p>
    <p><strong>Processo (NUP):</strong> ${payload.nup}</p>
    <p><strong>Descrição:</strong> ${payload.descricao}</p>
    <p><strong>Data:</strong> ${payload.created_at}</p>
    <p>Acesse o painel de monitoramento para mais detalhes.</p>
  `.trim();

  return { subject, text, html };
}

async function sendViaResend(
  input: EmailChannelInput,
  content: ReturnType<typeof buildEmailContent>,
): Promise<EmailChannelResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;

  if (!apiKey || !from) {
    return { success: false, error: 'Resend not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: content.subject,
      text: content.text,
      html: content.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      success: false,
      provider: 'resend',
      error: `Resend HTTP ${response.status}: ${body.slice(0, 200)}`,
    };
  }

  return { success: true, provider: 'resend' };
}

async function sendViaSmtp(
  input: EmailChannelInput,
  content: ReturnType<typeof buildEmailContent>,
): Promise<EmailChannelResult> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !from) {
    return { success: false, error: 'SMTP not configured' };
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });

  return { success: true, provider: 'smtp' };
}

export async function sendEmailNotification(
  input: EmailChannelInput,
): Promise<EmailChannelResult> {
  const log = createRequestLogger(input.payload.alerta_id, {
    route: 'notifications/email',
    usuario_id: input.payload.usuario_id,
  });

  const provider = resolveEmailProvider();

  if (!provider) {
    log.warn({ event: 'email_provider_missing' }, 'Email provider not configured');
    return { success: false, error: 'Email provider not configured' };
  }

  const content = buildEmailContent(input.payload);

  try {
    const result =
      provider === 'smtp'
        ? await sendViaSmtp(input, content)
        : await sendViaResend(input, content);

    if (result.success) {
      log.info({ event: 'email_dispatch_success', provider }, 'Email notification sent');
    } else {
      log.warn(
        { event: 'email_dispatch_failed', provider, error: result.error },
        'Email notification failed',
      );
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email send failed';
    log.warn({ event: 'email_dispatch_error', err: error }, message);
    return { success: false, provider, error: message };
  }
}

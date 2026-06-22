import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AlertaTipoEvento } from '@/lib/db/schema';
import {
  createDefaultEventPreferences,
  MONITORING_EVENT_TYPES,
  type NotificacaoPreferenciaRecord,
  type NotificationEventPreferences,
} from '@/types/notifications';

function parseEventPreferences(value: unknown): NotificationEventPreferences {
  const defaults = createDefaultEventPreferences();

  if (!value || typeof value !== 'object') {
    return defaults;
  }

  const record = value as Record<string, unknown>;

  for (const eventType of MONITORING_EVENT_TYPES) {
    if (typeof record[eventType] === 'boolean') {
      defaults[eventType] = record[eventType];
    }
  }

  return defaults;
}

function mapPreferenciaRow(row: Record<string, unknown>): NotificacaoPreferenciaRecord {
  return {
    id: String(row.id),
    usuario_id: String(row.usuario_id),
    orgao_id: String(row.orgao_id),
    email_eventos: parseEventPreferences(row.email_eventos),
    webhook_url: typeof row.webhook_url === 'string' ? row.webhook_url : null,
    webhook_secret: typeof row.webhook_secret === 'string' ? row.webhook_secret : null,
    webhook_eventos: parseEventPreferences(row.webhook_eventos),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getNotificacaoPreferencia(
  supabase: SupabaseClient,
  usuarioId: string,
  orgaoId: string,
): Promise<NotificacaoPreferenciaRecord | null> {
  const { data, error } = await supabase
    .from('notificacao_preferencia')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao carregar preferências de notificação: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapPreferenciaRow(data as Record<string, unknown>);
}

export async function getOrCreateNotificacaoPreferencia(
  supabase: SupabaseClient,
  usuarioId: string,
  orgaoId: string,
): Promise<NotificacaoPreferenciaRecord> {
  const existing = await getNotificacaoPreferencia(supabase, usuarioId, orgaoId);

  if (existing) {
    return existing;
  }

  const defaults = createDefaultEventPreferences();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('notificacao_preferencia')
    .insert({
      usuario_id: usuarioId,
      orgao_id: orgaoId,
      email_eventos: defaults,
      webhook_eventos: defaults,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Falha ao criar preferências de notificação: ${error?.message ?? 'unknown'}`,
    );
  }

  return mapPreferenciaRow(data as Record<string, unknown>);
}

export interface UpdateNotificacaoPreferenciaInput {
  email_eventos?: Partial<NotificationEventPreferences>;
  webhook_eventos?: Partial<NotificationEventPreferences>;
  webhook_url?: string | null;
  webhook_secret?: string | null;
}

export async function updateNotificacaoPreferencia(
  supabase: SupabaseClient,
  usuarioId: string,
  orgaoId: string,
  input: UpdateNotificacaoPreferenciaInput,
): Promise<NotificacaoPreferenciaRecord> {
  const current = await getOrCreateNotificacaoPreferencia(supabase, usuarioId, orgaoId);

  const nextEmail = { ...current.email_eventos, ...input.email_eventos };
  const nextWebhook = { ...current.webhook_eventos, ...input.webhook_eventos };

  const { data, error } = await supabase
    .from('notificacao_preferencia')
    .update({
      email_eventos: nextEmail,
      webhook_eventos: nextWebhook,
      webhook_url: input.webhook_url === undefined ? current.webhook_url : input.webhook_url,
      webhook_secret:
        input.webhook_secret === undefined ? current.webhook_secret : input.webhook_secret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .eq('usuario_id', usuarioId)
    .eq('orgao_id', orgaoId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(
      `Falha ao atualizar preferências de notificação: ${error?.message ?? 'unknown'}`,
    );
  }

  return mapPreferenciaRow(data as Record<string, unknown>);
}

export function isEventEnabledForChannel(
  preferencia: NotificacaoPreferenciaRecord,
  channel: 'email' | 'webhook',
  tipoEvento: AlertaTipoEvento,
): boolean {
  if (channel === 'email') {
    return preferencia.email_eventos[tipoEvento] === true;
  }

  return (
    preferencia.webhook_eventos[tipoEvento] === true
    && Boolean(preferencia.webhook_url)
    && Boolean(preferencia.webhook_secret)
  );
}

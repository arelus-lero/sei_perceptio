import type { AlertaTipoEvento } from '@/lib/db/schema';

export const MONITORING_EVENT_TYPES: AlertaTipoEvento[] = [
  'novo_andamento',
  'alteracao_status',
  'prazo_proximo',
  'anexacao',
  'distribuicao',
];

export type NotificationChannel = 'email' | 'webhook';

export type NotificationEventPreferences = Record<AlertaTipoEvento, boolean>;

export interface NotificacaoPreferenciaRecord {
  id: string;
  usuario_id: string;
  orgao_id: string;
  email_eventos: NotificationEventPreferences;
  webhook_url: string | null;
  webhook_secret: string | null;
  webhook_eventos: NotificationEventPreferences;
  created_at: string;
  updated_at: string;
}

export interface MonitoringNotificationPayload {
  alerta_id: string;
  tipo_evento: AlertaTipoEvento;
  processo_id: string;
  nup: string;
  descricao: string;
  monitoramento_id: string;
  orgao_id: string;
  usuario_id: string;
  usuario_email: string | null;
  created_at: string;
}

export interface ChannelDispatchResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
}

export interface DispatchMonitoringSummary {
  alertas_processados: number;
  email_enviados: number;
  email_falhas: number;
  webhook_enviados: number;
  webhook_falhas: number;
}

export const MONITORING_EVENT_LABELS: Record<AlertaTipoEvento, string> = {
  novo_andamento: 'Novo andamento',
  alteracao_status: 'Alteração de status',
  prazo_proximo: 'Prazo próximo',
  anexacao: 'Anexação / desanexação',
  distribuicao: 'Distribuição',
};

export function createDefaultEventPreferences(): NotificationEventPreferences {
  return {
    novo_andamento: false,
    alteracao_status: false,
    prazo_proximo: false,
    anexacao: false,
    distribuicao: false,
  };
}

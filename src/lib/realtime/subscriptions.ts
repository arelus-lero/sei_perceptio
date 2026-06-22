import type {
  RealtimeChannel,
  RealtimePostgresInsertPayload,
  SupabaseClient,
} from '@supabase/supabase-js';

import type { AlertaListItem } from '@/types/monitoring';

interface AlertaRow {
  id: string;
  monitoramento_id: string;
  tipo_evento: AlertaListItem['tipo_evento'];
  processo_id: string;
  descricao: string;
  lido: boolean;
  data_criacao: string;
  orgao_id: string;
}

export interface AlertaSubscriptionOptions {
  orgaoId: string;
  monitoramentoIds: Set<string>;
  onInsert: (alerta: AlertaListItem) => void;
  onUpdate?: (alerta: Pick<AlertaListItem, 'id' | 'lido'>) => void;
}

function isUserAlert(
  row: AlertaRow,
  monitoramentoIds: Set<string>,
): boolean {
  return monitoramentoIds.has(row.monitoramento_id);
}

export function subscribeToAlertas(
  supabase: SupabaseClient,
  options: AlertaSubscriptionOptions,
): RealtimeChannel {
  const channel = supabase
    .channel(`alertas-orgao-${options.orgaoId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'alerta',
        filter: `orgao_id=eq.${options.orgaoId}`,
      },
      (payload: RealtimePostgresInsertPayload<AlertaRow>) => {
        const row = payload.new;
        if (!isUserAlert(row, options.monitoramentoIds)) {
          return;
        }

        options.onInsert({
          id: row.id,
          monitoramento_id: row.monitoramento_id,
          tipo_evento: row.tipo_evento,
          processo_id: row.processo_id,
          nup: '',
          descricao: row.descricao,
          lido: row.lido,
          data_criacao: row.data_criacao,
        });
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'alerta',
        filter: `orgao_id=eq.${options.orgaoId}`,
      },
      (payload) => {
        if (!options.onUpdate) {
          return;
        }

        const row = payload.new as AlertaRow;
        if (!isUserAlert(row, options.monitoramentoIds)) {
          return;
        }

        options.onUpdate({ id: row.id, lido: row.lido });
      },
    )
    .subscribe();

  return channel;
}

export async function unsubscribeFromAlertas(
  supabase: SupabaseClient,
  channel: RealtimeChannel,
): Promise<void> {
  await supabase.removeChannel(channel);
}

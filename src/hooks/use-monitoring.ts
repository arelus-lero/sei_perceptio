'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createBrowserClient } from '@/lib/supabase/client';
import {
  subscribeToAlertas,
  unsubscribeFromAlertas,
} from '@/lib/realtime/subscriptions';
import type { AlertaListItem, MonitoramentoListItem } from '@/types/monitoring';

interface UseMonitoringState {
  alertas: AlertaListItem[];
  monitoramentos: MonitoramentoListItem[];
  totalNaoLidos: number;
  loading: boolean;
  error: string | null;
}

interface UseMonitoringActions {
  refresh: () => Promise<void>;
  markAsRead: (alertaId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useMonitoring(): UseMonitoringState & UseMonitoringActions {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [alertas, setAlertas] = useState<AlertaListItem[]>([]);
  const [monitoramentos, setMonitoramentos] = useState<MonitoramentoListItem[]>([]);
  const [totalNaoLidos, setTotalNaoLidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgaoId, setOrgaoId] = useState<string | null>(null);
  const monitoramentoIdsRef = useRef<Set<string>>(new Set());
  const processoNupRef = useRef<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    setError(null);

    const [alertasResponse, monitoramentosResponse] = await Promise.all([
      fetch('/api/alertas?limite=100'),
      fetch('/api/monitoramento?ativo=true'),
    ]);

    if (!alertasResponse.ok || !monitoramentosResponse.ok) {
      throw new Error('Falha ao carregar dados de monitoramento');
    }

    const alertasPayload = (await alertasResponse.json()) as {
      alertas: AlertaListItem[];
      total_nao_lidos: number;
    };
    const monitoramentosPayload = (await monitoramentosResponse.json()) as {
      monitoramentos: MonitoramentoListItem[];
    };

    setAlertas(alertasPayload.alertas);
    setTotalNaoLidos(alertasPayload.total_nao_lidos);
    setMonitoramentos(monitoramentosPayload.monitoramentos);

    monitoramentoIdsRef.current = new Set(
      monitoramentosPayload.monitoramentos.map((item) => item.id),
    );
    processoNupRef.current = new Map(
      monitoramentosPayload.monitoramentos.map((item) => [item.processo_id, item.nup]),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const orgaoFromJwt =
          typeof user?.app_metadata?.orgao_id === 'string'
            ? user.app_metadata.orgao_id
            : null;

        if (!cancelled) {
          setOrgaoId(orgaoFromJwt);
        }

        await refresh();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Erro ao carregar monitoramento',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [refresh, supabase]);

  useEffect(() => {
    if (!orgaoId) {
      return;
    }

    const channel = subscribeToAlertas(supabase, {
      orgaoId,
      monitoramentoIds: monitoramentoIdsRef.current,
      onInsert: (alerta) => {
        const nup = processoNupRef.current.get(alerta.processo_id) ?? alerta.nup;
        setAlertas((current) => [{ ...alerta, nup }, ...current]);
        setTotalNaoLidos((count) => count + 1);
      },
      onUpdate: ({ id, lido }) => {
        if (!lido) {
          return;
        }

        setAlertas((current) =>
          current.map((item) => (item.id === id ? { ...item, lido: true } : item)),
        );
        setTotalNaoLidos((count) => Math.max(0, count - 1));
      },
    });

    return () => {
      void unsubscribeFromAlertas(supabase, channel);
    };
  }, [orgaoId, supabase, monitoramentos]);

  const markAsRead = useCallback(async (alertaId: string) => {
    const response = await fetch(`/api/alertas/${alertaId}/read`, {
      method: 'PATCH',
    });

    if (!response.ok) {
      throw new Error('Falha ao marcar alerta como lido');
    }

    setAlertas((current) =>
      current.map((item) =>
        item.id === alertaId && !item.lido
          ? { ...item, lido: true }
          : item,
      ),
    );
    setTotalNaoLidos((count) => Math.max(0, count - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = alertas.filter((item) => !item.lido);
    await Promise.all(unread.map((item) => markAsRead(item.id)));
  }, [alertas, markAsRead]);

  return {
    alertas,
    monitoramentos,
    totalNaoLidos,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}

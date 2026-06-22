import { parseISO, subDays } from 'date-fns';

import { getTimelineProcessColor } from '@/lib/processo/timeline-colors';
import type {
  TimelineCompareEvento,
  TimelineCompareProcesso,
  TimelineEvento,
  TimelineFilters,
  TimelinePeriodoPreset,
} from '@/types/timeline';
import type { TimelineApiResponse } from '@/types/timeline';

const PERIOD_DAYS: Record<Exclude<TimelinePeriodoPreset, 'tudo'>, number> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
};

export function filterTimelineEventos(
  eventos: TimelineEvento[],
  filters: TimelineFilters,
): TimelineEvento[] {
  const periodStart = resolvePeriodStart(eventos, filters.periodo);
  return applyEventFilters(eventos, filters, periodStart);
}

export function getTimelineDomain(
  eventos: TimelineEvento[],
): { inicio: Date; fim: Date } | null {
  if (eventos.length === 0) {
    return null;
  }

  const timestamps = eventos.map((evento) => parseISO(evento.data_hora).getTime());
  return {
    inicio: new Date(Math.min(...timestamps)),
    fim: new Date(Math.max(...timestamps)),
  };
}

function resolvePeriodStart(
  eventos: TimelineEvento[],
  periodo: TimelinePeriodoPreset,
): Date | null {
  if (periodo === 'tudo' || eventos.length === 0) {
    return null;
  }

  const latestTimestamp = Math.max(
    ...eventos.map((evento) => parseISO(evento.data_hora).getTime()),
  );

  return subDays(new Date(latestTimestamp), PERIOD_DAYS[periodo]);
}

function applyEventFilters(
  eventos: TimelineEvento[],
  filters: TimelineFilters,
  periodStart: Date | null,
): TimelineEvento[] {
  let result = [...eventos];

  if (filters.apenasMarcos) {
    result = result.filter((evento) => evento.destaque);
  }

  if (filters.unidade) {
    result = result.filter(
      (evento) =>
        evento.unidade_origem === filters.unidade ||
        evento.unidade_destino === filters.unidade,
    );
  }

  if (periodStart) {
    result = result.filter(
      (evento) => parseISO(evento.data_hora).getTime() >= periodStart.getTime(),
    );
  }

  return result.sort(
    (a, b) => parseISO(b.data_hora).getTime() - parseISO(a.data_hora).getTime(),
  );
}

export function filterCompareProcessos(
  processos: TimelineApiResponse[],
  filters: TimelineFilters,
): TimelineCompareProcesso[] {
  const allEventos = processos.flatMap((processo) => processo.eventos);
  const periodStart = resolvePeriodStart(allEventos, filters.periodo);

  return processos.map((processo, index) => ({
    nup: processo.nup,
    processo_id: processo.processo_id,
    tipo_processo_desc: processo.tipo_processo_desc,
    status: processo.status,
    cor: getTimelineProcessColor(index),
    eventos: applyEventFilters(processo.eventos, filters, periodStart),
  }));
}

export function flattenCompareEventos(
  processos: TimelineCompareProcesso[],
): TimelineCompareEvento[] {
  return processos.flatMap((processo) =>
    processo.eventos.map((evento) => ({
      ...evento,
      nup: processo.nup,
      processo_id: processo.processo_id,
      processo_cor: processo.cor,
    })),
  );
}

export function getCompareTimelineDomain(
  processos: TimelineCompareProcesso[],
): { inicio: Date; fim: Date } | null {
  const eventos = processos.flatMap((processo) => processo.eventos);
  return getTimelineDomain(eventos);
}

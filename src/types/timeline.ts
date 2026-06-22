import type { AndamentoTipo } from '@/lib/db/schema';

export type TimelineMarco =
  | 'distribuicao'
  | 'conclusao'
  | 'anexacao'
  | 'consulta_publica';

export type TimelineEventoTipo = AndamentoTipo | 'consulta_publica';

export interface TimelineEvento {
  id: string;
  data_hora: string;
  tipo: TimelineEventoTipo;
  unidade_origem: string | null;
  unidade_destino: string | null;
  descricao: string;
  destaque: boolean;
  marco: TimelineMarco | null;
}

export interface ProcessoTimelineData {
  nup: string;
  processo_id: string;
  tipo_processo_desc: string;
  status: string;
  unidades: string[];
  eventos: TimelineEvento[];
}

export type TimelinePeriodoPreset =
  | '30d'
  | '90d'
  | '180d'
  | '365d'
  | 'tudo';

export interface TimelineFilters {
  unidade: string | null;
  periodo: TimelinePeriodoPreset;
  apenasMarcos: boolean;
}

export interface TimelineApiResponse {
  nup: string;
  processo_id: string;
  tipo_processo_desc: string;
  status: string;
  unidades: string[];
  eventos: TimelineEvento[];
}

export const MAX_TIMELINE_COMPARE = 5;

export interface TimelineCompareProcesso {
  nup: string;
  processo_id: string;
  tipo_processo_desc: string;
  status: string;
  cor: string;
  eventos: TimelineEvento[];
}

export interface TimelineCompareEvento extends TimelineEvento {
  nup: string;
  processo_id: string;
  processo_cor: string;
}

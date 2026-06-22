import type { AndamentoTipo, ProcessoStatus } from '@/lib/db/schema';

export interface StatusCount {
  status: ProcessoStatus;
  total: number;
}

export interface UnidadeCount {
  unidade: string;
  total: number;
}

export interface TipoProcessoCount {
  codigo: string;
  descricao: string;
  total: number;
}

export interface PrazoProximo {
  processo_id: string;
  nup: string;
  data_encerramento: string;
  dias_restantes: number;
}

export interface AtividadeRecente {
  id: string;
  processo_id: string;
  nup: string;
  data_hora: string;
  tipo: AndamentoTipo;
  descricao: string;
  unidade: string;
}

export interface DashboardData {
  total_processos: number;
  contagem_por_status: StatusCount[];
  processos_por_unidade: UnidadeCount[];
  tempo_medio_tramitacao_dias: number;
  proximos_prazos: PrazoProximo[];
  atividade_recente: AtividadeRecente[];
  distribuicao_por_tipo: TipoProcessoCount[];
}

export interface DashboardProcessoItem {
  id: string;
  nup: string;
  status: ProcessoStatus;
  unidade_atual: string;
  tipo_processo_codigo: string;
  tipo_processo_desc: string;
  data_geracao: string;
  updated_at: string;
}

export interface DashboardProcessosPage {
  items: DashboardProcessoItem[];
  pagination: {
    limit: number;
    offset: number | null;
    total: number;
    has_more: boolean;
    next_cursor: { updated_at: string; id: string } | null;
  };
}

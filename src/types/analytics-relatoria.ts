export interface RelatoriaRegistro {
  id: string;
  processo_id: string;
  nup: string;
  data_hora: string;
  unidade: string;
  descricao: string;
  relator_id: string | null;
  relator_nome: string | null;
  sessao_distribuicao: string | null;
  resultado_deliberativo: string | null;
}

export interface RelatoriaCountItem {
  chave: string;
  rotulo: string;
  total: number;
}

export interface RelatoriaAnalyticsData {
  total_distribuicoes: number;
  por_relator: RelatoriaCountItem[];
  por_sessao: RelatoriaCountItem[];
  por_resultado: RelatoriaCountItem[];
  registros: RelatoriaRegistro[];
  filtros_disponiveis: {
    relatores: Array<{ id: string; nome: string }>;
    sessoes: string[];
    resultados: string[];
  };
}

export interface RelatoriaAnalyticsFilters {
  relator_id?: string;
  sessao_distribuicao?: string;
  resultado_deliberativo?: string;
  q?: string;
  data_inicio?: string;
  data_fim?: string;
}

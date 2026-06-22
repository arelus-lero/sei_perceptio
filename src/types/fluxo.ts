export interface FluxoSegmento {
  unidade: string;
  data_entrada: string;
  data_saida: string | null;
  dias_permanencia: number;
  andamentos_no_segmento: number;
}

export interface FluxoUnidadeResumo {
  unidade: string;
  total_dias: number;
  visitas: number;
  media_dias_por_visita: number;
  gargalo: boolean;
}

export interface FluxoTramitacaoData {
  nup: string;
  processo_id: string;
  segmentos: FluxoSegmento[];
  resumo_unidades: FluxoUnidadeResumo[];
  gargalos: FluxoUnidadeResumo[];
  tempo_total_dias: number;
  ordem_unidades: string[];
  limite_gargalo_dias: number;
}

export type FluxoApiResponse = FluxoTramitacaoData;

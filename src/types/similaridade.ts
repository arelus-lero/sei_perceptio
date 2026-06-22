import type { ProcessoStatus } from '@/lib/db/schema';

export interface SimilaridadeDimensao {
  tipo: number;
  conteudo: number;
  fluxo: number;
  interessados: number;
}

export interface ProcessoSimilarItem {
  processo_id: string;
  nup: string;
  tipo_processo_codigo: string;
  tipo_processo_desc: string;
  status: ProcessoStatus;
  score_total: number;
  dimensoes: SimilaridadeDimensao;
  motivos: string[];
}

export interface SimilaridadeProcessualData {
  nup_referencia: string;
  processo_referencia_id: string;
  pesos: {
    tipo: number;
    conteudo: number;
    fluxo: number;
    interessados: number;
  };
  resultados: ProcessoSimilarItem[];
}

export type SimilaridadeApiResponse = SimilaridadeProcessualData;

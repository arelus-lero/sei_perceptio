import type { ProcessoStatus } from '@/lib/db/schema';

export type RelacaoNodeKind =
  | 'central'
  | 'pai'
  | 'filho'
  | 'referenciado'
  | 'relacionado';

export type RelacaoEdgeTipo =
  | 'anexacao'
  | 'referencia'
  | 'mesmo_interessado'
  | 'mesmo_tipo';

export interface RelacaoNode {
  id: string;
  nup: string;
  label: string;
  tipo: RelacaoNodeKind;
  status: ProcessoStatus;
  tipo_processo_desc: string;
}

export interface RelacaoEdge {
  id: string;
  source: string;
  target: string;
  tipo: RelacaoEdgeTipo;
  data: string | null;
  label: string;
}

export interface RelacoesGraphData {
  nup_central: string;
  processo_central_id: string;
  nodes: RelacaoNode[];
  edges: RelacaoEdge[];
}

export type RelacoesApiResponse = RelacoesGraphData;

export type RelacaoEdgeFilter = RelacaoEdgeTipo | 'todos';

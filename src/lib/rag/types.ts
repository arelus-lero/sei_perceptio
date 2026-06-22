export type ConfidenceLevel = 'alto' | 'medio' | 'baixo';

export interface ChunkSourceMetadata {
  fonte_id?: string;
  filename?: string;
  anonimizada?: boolean;
  ocr_applied?: boolean;
  numero_sei?: string;
  tipo_documento?: string;
  unidade_geradora?: string;
  data?: string;
}

export interface SemanticChunk {
  conteudo: string;
  posicao_inicio: number;
  posicao_fim: number;
  metadados: ChunkSourceMetadata & {
    posicao_inicio: number;
    posicao_fim: number;
  };
}

export interface RetrievedChunk {
  id: string;
  fonte_id: string;
  conteudo: string;
  metadados_json: Record<string, unknown>;
  score_rrf: number;
  numero_sei?: string;
  tipo_documento?: string;
  unidade_geradora?: string;
  data?: string;
  /** Vetor pré-calculado na ingestão (384d), retornado pela RPC match_chunks_hybrid. */
  embedding?: number[];
}

export interface ConfidenceItem {
  afirmacao: string;
  nivel: ConfidenceLevel;
  chunk_id_referencia: string | null;
}

export interface ChatFilters {
  tipo_documento?: string[];
  unidade?: string[];
  data_inicio?: string;
  data_fim?: string;
  nup?: string;
  interessado?: string;
  tags?: string[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  conteudo: string;
}

export interface EmbedResponse {
  embeddings: number[][];
}

export interface RetrievalParams {
  query: string;
  notebookId: string;
  fontesAtivas?: string[];
  filtros?: ChatFilters;
  topK?: number;
  /** Tempo restante do pipeline (RNF-001) */
  getRemainingMs?: () => number;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerationParams {
  chunks: RetrievedChunk[];
  history: ConversationTurn[];
  userMessage: string;
  /** Instruções adicionais de template de análise, concatenadas ao SYSTEM_PROMPT. */
  systemPromptOverride?: string;
}

export interface VerificationParams {
  resposta: string;
  chunks: RetrievedChunk[];
  getRemainingMs?: () => number;
}

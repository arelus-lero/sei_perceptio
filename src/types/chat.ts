import type { TagItem } from '@/types/tag';
import type { FonteIngestionStatus } from '@/types/ingestion';

export interface NotebookFonte {
  id: string;
  titulo: string;
  ativa: boolean;
  tipo_origem: string;
  tags?: TagItem[];
  ingestion_status?: FonteIngestionStatus;
}

export interface ChatCitation {
  source_id: string;
  chunk_id: string;
  numero_sei: string;
  tipo: string;
  unidade: string;
  trecho: string;
  score: number;
}

export interface ChatConfidence {
  afirmacao: string;
  nivel: 'alto' | 'medio' | 'baixo';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
  confidence?: ChatConfidence[];
  streaming?: boolean;
  degraded?: boolean;
}

export type ChatSseEvent =
  | { type: 'token'; content: string }
  | {
      type: 'citation';
      source_id: string;
      chunk_id: string;
      numero_sei: string;
      tipo: string;
      unidade: string;
      trecho: string;
      score: number;
    }
  | { type: 'confidence'; afirmacao: string; nivel: 'alto' | 'medio' | 'baixo' }
  | { type: 'degraded'; message: string }
  | { type: 'done'; conversa_id: string; degraded?: boolean }
  | { type: 'error'; message: string };

export interface ChatRequestBody {
  notebook_id: string;
  conversa_id: string | null;
  mensagem: string;
  template_id?: string;
  fontes_ativas?: string[];
  filtros?: {
    tipo_documento?: string[];
    unidade?: string[];
    data_inicio?: string;
    data_fim?: string;
    nup?: string;
    interessado?: string;
    tags?: string[];
  };
}

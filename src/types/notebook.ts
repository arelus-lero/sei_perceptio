export interface NotebookListItem {
  id: string;
  nome: string;
  descricao: string | null;
  fontes_count: number;
  data_criacao: string;
  compartilhado: boolean;
}

export interface NotebookDetail {
  id: string;
  nome: string;
  descricao: string | null;
  orgao_id: string;
  usuario_criador_id: string;
  created_at: string;
  updated_at: string;
  compartilhado?: boolean;
  permissao?: 'owner' | 'leitura' | 'comentario' | 'edicao' | null;
  can_read?: boolean;
  can_comment?: boolean;
  can_edit?: boolean;
  can_share?: boolean;
  can_export?: boolean;
}

export interface CreateNotebookInput {
  nome: string;
  descricao?: string;
}

export interface UpdateNotebookInput {
  nome?: string;
  descricao?: string | null;
}

export interface ConversationSummary {
  id: string;
  titulo: string | null;
  data_criacao: string;
  data_ultima_interacao: string;
  mensagens_count: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  conteudo: string;
  data_criacao: string;
}

export interface ConversationDetail extends ConversationSummary {
  mensagens: ConversationMessage[];
}

export interface SourceUploadResponse {
  fonte_id: string;
  status: 'processando' | 'pronto';
  checksum: string;
}

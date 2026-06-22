import type { CompartilhamentoPermissao } from '@/lib/db/schema';

export type NotebookAccessSource = 'owner' | CompartilhamentoPermissao;

export interface NotebookShareItem {
  id: string;
  usuario_destino_id: string;
  usuario_nome: string;
  usuario_email: string | null;
  permissao: CompartilhamentoPermissao;
  compartilhado_por_id: string;
  data_compartilhamento: string;
}

export interface OrgaoMembroItem {
  user_id: string;
  nome_completo: string;
  email: string | null;
  role: string;
}

export interface NotebookShareListResponse {
  compartilhamentos: NotebookShareItem[];
  membros_orgao: OrgaoMembroItem[];
  sigilo: NotebookSigiloInfo;
}

export interface NotebookSigiloInfo {
  contem_sigiloso: boolean;
  nups_sigilosos: string[];
  requer_confirmacao_admin: boolean;
}

export interface CreateNotebookShareInput {
  usuario_destino_id: string;
  permissao: CompartilhamentoPermissao;
  sigilo_confirmacao?: string;
}

export type NotebookExportFormat = 'markdown' | 'pdf';

export interface NotebookExportTraceability {
  versao: '1.0';
  notebook_id: string;
  notebook_nome: string;
  orgao_id: string;
  exportado_em: string;
  exportado_por_id: string;
  exportado_por_nome: string;
  formato: NotebookExportFormat;
  fontes_total: number;
  conversas_total: number;
  mensagens_total: number;
  contem_sigiloso: boolean;
  ia_declaration: string;
  checksum_sha256: string;
}

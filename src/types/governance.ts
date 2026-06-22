import type { AuditLogAcao, PoliticaRetencaoAcao } from '@/lib/db/schema';

export interface AuditLogListItem {
  id: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  acao: AuditLogAcao;
  entidade_tipo: string;
  entidade_id: string | null;
  detalhes_json: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  data_criacao: string;
}

export interface AuditLogListResponse {
  logs: AuditLogListItem[];
  total: number;
  pagina: number;
  por_pagina: number;
  retencao_anos: number;
}

export interface PoliticaRetencaoItem {
  id: string;
  nome: string;
  tipo_entidade: string;
  regra: {
    tipo: 'periodo_dias' | 'apos_conclusao';
    valor: number;
  };
  acao: PoliticaRetencaoAcao;
  ativo: boolean;
  criado_por_id: string;
  created_at: string;
}

export interface PoliticaRetencaoListResponse {
  politicas: PoliticaRetencaoItem[];
}

export interface OrgLimitsConfig {
  max_fontes_notebook: number;
  max_notebooks: number;
}

export interface AdminUsuarioListItem {
  user_id: string;
  email: string | null;
  role: string;
  nome_completo: string;
  sigla_unidade: string | null;
  created_at: string;
}

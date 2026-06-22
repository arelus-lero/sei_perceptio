/** Retenção mínima de logs de auditoria (RF-040). */
export const AUDIT_LOG_RETENTION_YEARS = 5;

export const AUDIT_LOG_RETENTION_DAYS = AUDIT_LOG_RETENTION_YEARS * 365;

export const AUDIT_LOG_ACTIONS = [
  'ingestao',
  'consulta',
  'modificacao',
  'exportacao',
  'login',
  'logout',
  'compartilhamento',
  'configuracao',
] as const;

export const RETENCAO_TIPO_ENTIDADE = [
  'fonte',
  'notebook',
  'processo',
  'documento',
] as const;

export const RETENCAO_REGRA_TIPOS = ['periodo_dias', 'apos_conclusao'] as const;

export const RETENCAO_ACOES = ['excluir', 'anonimizar'] as const;

export const RETENCAO_ACAO_LABELS: Record<(typeof RETENCAO_ACOES)[number], string> = {
  excluir: 'Exclusão',
  anonimizar: 'Anonimização irreversível',
};

export const AUDIT_ACTION_LABELS: Record<(typeof AUDIT_LOG_ACTIONS)[number], string> = {
  ingestao: 'Ingestão',
  consulta: 'Consulta RAG',
  modificacao: 'Modificação',
  exportacao: 'Exportação',
  login: 'Login',
  logout: 'Logout',
  compartilhamento: 'Compartilhamento',
  configuracao: 'Configuração',
};

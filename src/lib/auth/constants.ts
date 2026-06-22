import type { UserRole } from '@/lib/db/schema';

export const USER_ROLES = ['admin', 'analista', 'consultor'] as const satisfies readonly UserRole[];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  analista: 'Analista',
  consultor: 'Consultor',
};

/** Rotas de API bloqueadas para consultor em métodos mutáveis. */
export const CONSULTOR_WRITE_BLOCKED_API_PREFIXES = [
  '/api/admin',
  '/api/ingest',
] as const;

export const CONSULTOR_WRITE_BLOCKED_API_PATHS = [
  '/api/notebooks',
  '/api/monitoramento/check',
] as const;

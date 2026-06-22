import type { UserRole } from '@/lib/db/schema';

export function isAdmin(role: UserRole | null): boolean {
  return role === 'admin';
}

export function isAnalistaOrAdmin(role: UserRole | null): boolean {
  return role === 'admin' || role === 'analista';
}

export function isConsultor(role: UserRole | null): boolean {
  return role === 'consultor';
}

export function hasValidRole(role: UserRole | null): role is UserRole {
  return role === 'admin' || role === 'analista' || role === 'consultor';
}

export function canAccessAdminRoutes(role: UserRole | null): boolean {
  return isAdmin(role);
}

export function canManageUsers(role: UserRole | null): boolean {
  return isAdmin(role);
}

export function canManageRetention(role: UserRole | null): boolean {
  return isAdmin(role);
}

export function canViewFullAuditLog(role: UserRole | null): boolean {
  return isAdmin(role);
}

export function canWriteNotebooks(role: UserRole | null): boolean {
  return isAnalistaOrAdmin(role);
}

export function canUploadSources(role: UserRole | null): boolean {
  return isAnalistaOrAdmin(role);
}

export function canExportNotebooks(role: UserRole | null): boolean {
  return isAnalistaOrAdmin(role);
}

export function canShareNotebooks(role: UserRole | null): boolean {
  return isAnalistaOrAdmin(role);
}

export function canAssignTags(role: UserRole | null): boolean {
  return isAnalistaOrAdmin(role);
}

export function canRunMonitoringCheck(role: UserRole | null): boolean {
  return isAnalistaOrAdmin(role);
}

export function roleHasPermission(
  role: UserRole | null,
  allowed: readonly UserRole[],
): boolean {
  return role !== null && allowed.includes(role);
}

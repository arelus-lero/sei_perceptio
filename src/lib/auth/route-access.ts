import type { UserRole } from '@/lib/db/schema';

import {
  CONSULTOR_WRITE_BLOCKED_API_PATHS,
  CONSULTOR_WRITE_BLOCKED_API_PREFIXES,
} from '@/lib/auth/constants';

const MUTABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isConsultorWriteBlocked(
  pathname: string,
  method: string,
  role: UserRole | null,
): boolean {
  if (role !== 'consultor' || !MUTABLE_METHODS.has(method.toUpperCase())) {
    return false;
  }

  if (CONSULTOR_WRITE_BLOCKED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  if (CONSULTOR_WRITE_BLOCKED_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }

  if (pathname.includes('/export') || pathname.includes('/share')) {
    return true;
  }

  return false;
}

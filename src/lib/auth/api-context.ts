import type { NextRequest } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/db/schema';
import { hasValidRole } from '@/lib/auth/rbac';
import { createServerClient } from '@/lib/supabase/server';

export interface ApiAuthContext {
  supabase: SupabaseClient;
  user: User;
  orgaoId: string;
  role: UserRole;
}

function parseUserRole(value: string | null): UserRole | null {
  if (value === 'admin' || value === 'analista' || value === 'consultor') {
    return value;
  }
  return null;
}

export async function getApiAuthContext(
  request: NextRequest,
): Promise<ApiAuthContext | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const orgaoId = request.headers.get('x-orgao-id');
  const role = parseUserRole(request.headers.get('x-user-role'));

  if (!orgaoId || !hasValidRole(role)) {
    return null;
  }

  return {
    supabase,
    user,
    orgaoId,
    role,
  };
}

export async function requireApiAuth(
  request: NextRequest,
): Promise<ApiAuthContext | Response> {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }
  return auth;
}

export function requireRole(
  auth: ApiAuthContext,
  allowed: readonly UserRole[],
  message = 'Forbidden',
): Response | null {
  if (!allowed.includes(auth.role)) {
    return forbiddenResponse(message);
  }
  return null;
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbiddenResponse(message = 'Forbidden') {
  return Response.json({ error: message }, { status: 403 });
}

export function missingOrgaoResponse() {
  return Response.json({ error: 'Missing orgao context' }, { status: 400 });
}

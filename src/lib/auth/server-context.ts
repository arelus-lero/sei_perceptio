import type { SupabaseClient, User } from '@supabase/supabase-js';

import { hasValidRole } from '@/lib/auth/rbac';
import type { UserRole } from '@/lib/db/schema';
import { createServerClient } from '@/lib/supabase/server';

export interface ServerAuthContext {
  supabase: SupabaseClient;
  user: User;
  orgaoId: string;
  role: UserRole;
}

function parseUserRole(value: unknown): UserRole | null {
  if (value === 'admin' || value === 'analista' || value === 'consultor') {
    return value;
  }
  return null;
}

export async function getServerAuthContext(): Promise<ServerAuthContext | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const orgaoId = user.app_metadata?.orgao_id;
  const role = parseUserRole(user.app_metadata?.role);

  if (typeof orgaoId !== 'string' || orgaoId.length === 0 || !hasValidRole(role)) {
    return null;
  }

  return {
    supabase,
    user,
    orgaoId,
    role,
  };
}

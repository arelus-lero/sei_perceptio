import 'server-only';

import type { UserRole } from '@/lib/db/schema';
import { createAdminClient } from '@/lib/supabase/admin-client';

export interface ProvisionAuthUserInput {
  email: string;
  orgaoId: string;
  role: UserRole;
  nomeCompleto: string;
  password?: string;
}

export interface UpdateAuthUserRoleInput {
  userId: string;
  orgaoId: string;
  role: UserRole;
  nomeCompleto?: string;
}

/**
 * Cria usuário no Supabase Auth com app_metadata (service_role).
 * Triggers `enforce_auth_user_app_metadata` + `on_auth_user_created` criam/sincronizam `perfil`.
 * Nunca chame isto a partir do browser.
 */
export async function provisionAuthUser(
  input: ProvisionAuthUserInput,
): Promise<{ userId: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: {
      orgao_id: input.orgaoId,
      role: input.role,
      nome_completo: input.nomeCompleto,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Falha ao provisionar usuário');
  }

  return { userId: data.user.id };
}

/**
 * Atualiza role/orgao em app_metadata e em `perfil` (server-side only).
 */
export async function updateAuthUserRole(
  input: UpdateAuthUserRoleInput,
): Promise<void> {
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from('perfil')
    .select('nome_completo')
    .eq('user_id', input.userId)
    .eq('orgao_id', input.orgaoId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!existing) {
    throw new Error('Usuário não encontrado neste órgão');
  }

  const nomeCompleto = input.nomeCompleto ?? existing.nome_completo;

  const { error: authError } = await admin.auth.admin.updateUserById(input.userId, {
    app_metadata: {
      orgao_id: input.orgaoId,
      role: input.role,
      nome_completo: nomeCompleto,
    },
  });

  if (authError) {
    throw new Error(authError.message);
  }

  const { error: perfilError } = await admin
    .from('perfil')
    .update({
      role: input.role,
      nome_completo: nomeCompleto,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', input.userId)
    .eq('orgao_id', input.orgaoId);

  if (perfilError) {
    throw new Error(perfilError.message);
  }
}

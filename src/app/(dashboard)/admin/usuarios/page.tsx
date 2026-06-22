import { Users } from 'lucide-react';
import { redirect } from 'next/navigation';

import { UsuariosPanel } from '@/components/governance/usuarios-panel';
import { PageTitle } from '@/components/layout/headings';
import { canManageUsers } from '@/lib/auth/rbac';
import { getServerAuthContext } from '@/lib/auth/server-context';
import { createAdminClient } from '@/lib/supabase/admin-client';
import type { AdminUsuarioListItem } from '@/types/governance';

async function listAdminUsuarios(
  orgaoId: string,
): Promise<AdminUsuarioListItem[]> {
  const admin = createAdminClient();

  const { data: perfis, error } = await admin
    .from('perfil')
    .select('user_id, role, nome_completo, sigla_unidade, created_at')
    .eq('orgao_id', orgaoId)
    .order('nome_completo', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return Promise.all(
    (perfis ?? []).map(async (perfil) => {
      const { data: userData } = await admin.auth.admin.getUserById(perfil.user_id);

      return {
        user_id: perfil.user_id,
        email: userData.user?.email ?? null,
        role: perfil.role,
        nome_completo: perfil.nome_completo,
        sigla_unidade: perfil.sigla_unidade,
        created_at: perfil.created_at,
      };
    }),
  );
}

export default async function AdminUsuariosPage() {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  if (!canManageUsers(auth.role)) {
    redirect('/dashboard');
  }

  const usuarios = await listAdminUsuarios(auth.orgaoId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" aria-hidden />
          <PageTitle>Gestão de usuários</PageTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Provisionamento de contas e atribuição de perfis RBAC (admin, analista,
          consultor) no âmbito do órgão.
        </p>
      </header>

      <UsuariosPanel
        initialUsuarios={usuarios}
        currentUserId={auth.user.id}
      />
    </div>
  );
}

import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { hasValidRole } from '@/lib/auth/rbac';
import { createServerClient } from '@/lib/supabase/server';

interface LoginPageProps {
  searchParams: Promise<{ error?: string; reason?: string }>;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  auth_callback: 'Não foi possível concluir a autenticação. Tente novamente.',
  auth_missing_code: 'Link de acesso inválido ou expirado.',
  auth_incomplete:
    'Sua conta não está provisionada (orgao_id ou perfil ausente). Solicite cadastro ao administrador.',
  auth_required: 'Faça login para continuar.',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const orgaoId = user.app_metadata?.orgao_id;
    const role = user.app_metadata?.role;

    if (
      typeof orgaoId === 'string'
      && orgaoId.length > 0
      && hasValidRole(role)
    ) {
      redirect('/dashboard');
    }

    await supabase.auth.signOut();
  }

  const params = await searchParams;
  const callbackError = params.error
    ? (AUTH_ERROR_MESSAGES[params.error] ?? 'Erro de autenticação.')
    : null;
  const inactiveSessionMessage =
    params.reason === 'inactive'
      ? 'Sua sessão expirou por inatividade. Faça login novamente.'
      : null;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-full flex-1 items-center justify-center p-6 outline-none"
    >
      <LoginForm
        callbackError={callbackError}
        inactiveSessionMessage={inactiveSessionMessage}
      />
    </main>
  );
}

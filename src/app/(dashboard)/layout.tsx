import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { GlossaryProviders } from '@/components/glossary/glossary-providers';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InactivityTimeoutGuard } from '@/components/layout/inactivity-timeout-guard';
import { OnboardingProvider } from '@/components/onboarding/onboarding-provider';
import { getServerAuthContext } from '@/lib/auth/server-context';
import {
  readSidebarOpenFromCookie,
  SIDEBAR_COOKIE_NAME,
} from '@/lib/sidebar/constants';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const auth = await getServerAuthContext();

  if (!auth) {
    redirect('/login');
  }

  const { data: perfil } = await auth.supabase
    .from('perfil')
    .select('onboarding_concluido')
    .eq('user_id', auth.user.id)
    .eq('orgao_id', auth.orgaoId)
    .maybeSingle();

  const onboardingConcluido = perfil?.onboarding_concluido === true;
  const cookieStore = await cookies();
  const defaultSidebarOpen = readSidebarOpenFromCookie(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value,
  );

  return (
    <InactivityTimeoutGuard>
      <GlossaryProviders>
        <OnboardingProvider onboardingConcluido={onboardingConcluido}>
          <DashboardShell isAdmin={auth.role === 'admin'} defaultSidebarOpen={defaultSidebarOpen}>
            {children}
          </DashboardShell>
        </OnboardingProvider>
      </GlossaryProviders>
    </InactivityTimeoutGuard>
  );
}

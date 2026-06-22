import { redirect } from 'next/navigation';

import { RelacoesView } from '@/components/processo/relacoes-view';
import { getServerAuthContext } from '@/lib/auth/server-context';

interface RelacoesPageProps {
  searchParams: Promise<{ nup?: string }>;
}

export default async function RelacoesPage({ searchParams }: RelacoesPageProps) {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  const { nup } = await searchParams;

  return <RelacoesView initialNup={nup ?? ''} />;
}

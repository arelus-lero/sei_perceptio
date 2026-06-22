import { Archive } from 'lucide-react';
import { redirect } from 'next/navigation';

import { RetencaoPanel } from '@/components/governance/retencao-panel';
import { PageTitle } from '@/components/layout/headings';
import { canManageRetention } from '@/lib/auth/rbac';
import { getServerAuthContext } from '@/lib/auth/server-context';
import type { PoliticaRetencaoItem } from '@/types/governance';

export default async function AdminRetencaoPage() {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  if (!canManageRetention(auth.role)) {
    redirect('/dashboard');
  }

  const { data, error } = await auth.supabase
    .from('politica_retensao')
    .select('id, nome, tipo_entidade, regra, acao, ativo, criado_por_id, created_at')
    .eq('orgao_id', auth.orgaoId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Admin retencao page error:', error);
    throw error;
  }

  const politicas = (data ?? []) as PoliticaRetencaoItem[];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Archive className="size-5 text-primary" aria-hidden />
          <PageTitle>Políticas de retenção</PageTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure retenção por período ou após conclusão do processo, com
          exclusão ou anonimização irreversível ao expirar (RF-043 / LGPD).
        </p>
      </header>

      <RetencaoPanel initialPoliticas={politicas} />
    </div>
  );
}

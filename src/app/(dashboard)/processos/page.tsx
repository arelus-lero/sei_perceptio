import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FolderOpen } from 'lucide-react';

import { SeiTerm } from '@/components/glossary/sei-term';
import { PageTitle } from '@/components/layout/headings';
import { Badge } from '@/components/ui/badge';
import { getServerAuthContext } from '@/lib/auth/server-context';
import { getDashboardProcessosPage } from '@/lib/db/queries/dashboard';
import type { ProcessoStatus } from '@/lib/db/schema';
import { processoTimelineHref } from '@/lib/utils/processo-url';

const STATUS_LABELS: Record<ProcessoStatus, string> = {
  aberto: 'Aberto',
  em_tramitacao: 'Em tramitação',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

export default async function ProcessosPage() {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  const page = await getDashboardProcessosPage(auth.supabase, auth.orgaoId, { limit: 100 });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-5 text-primary" aria-hidden />
          <PageTitle>Processos</PageTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Lista de processos <SeiTerm term="sei">SEI</SeiTerm> do órgão. Acesse a linha do
          tempo e o detalhe por <SeiTerm term="nup">NUP</SeiTerm>.
        </p>
      </header>

      {page.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum processo indexado para este órgão.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {page.items.map((processo) => (
            <li key={processo.id}>
              <Link
                href={processoTimelineHref(processo.nup)}
                className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="space-y-1">
                  <p className="font-mono text-sm font-medium">{processo.nup}</p>
                  <p className="text-xs text-muted-foreground">
                    {processo.tipo_processo_desc} · {processo.unidade_atual}
                  </p>
                </div>
                <Badge variant="secondary">
                  {STATUS_LABELS[processo.status] ?? processo.status}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { LayoutDashboard } from 'lucide-react';
import { redirect } from 'next/navigation';

import { SeiTerm } from '@/components/glossary/sei-term';
import { PageTitle, SectionTitle } from '@/components/layout/headings';
import { AtividadeRecenteList } from '@/components/dashboard/atividade-recente';
import { PrazosList } from '@/components/dashboard/prazos-list';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { StatusChart } from '@/components/dashboard/status-chart';
import { TipoChart } from '@/components/dashboard/tipo-chart';
import { UnidadeChart } from '@/components/dashboard/unidade-chart';
import { getServerAuthContext } from '@/lib/auth/server-context';
import { getDashboardData } from '@/lib/db/queries/dashboard';

export default async function DashboardPage() {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  let data;
  try {
    data = await getDashboardData(auth.supabase, auth.orgaoId);
  } catch (error) {
    console.error('Dashboard data error:', error);
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-5 text-primary" aria-hidden />
          <PageTitle>Dashboard consolidado</PageTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Visão agregada dos processos do órgão com métricas de status, unidade,{' '}
          <SeiTerm term="tramitacao">tramitação</SeiTerm> e{' '}
          <SeiTerm term="prazo">prazos</SeiTerm>.
        </p>
      </header>

      <StatsCards
        data={{
          total_processos: data.total_processos,
          tempo_medio_tramitacao_dias: data.tempo_medio_tramitacao_dias,
          contagem_por_status: data.contagem_por_status,
        }}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SectionTitle className="mb-4">Contagem por status</SectionTitle>
          <StatusChart data={data.contagem_por_status} />
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SectionTitle className="mb-4">Processos por unidade</SectionTitle>
          <UnidadeChart data={data.processos_por_unidade} />
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SectionTitle className="mb-4">
            Próximos <SeiTerm term="prazo">prazos</SeiTerm>
          </SectionTitle>
          <PrazosList prazos={data.proximos_prazos} />
        </article>

        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SectionTitle className="mb-4">Atividade recente</SectionTitle>
          <AtividadeRecenteList atividades={data.atividade_recente} />
        </article>
      </section>

      <section>
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SectionTitle className="mb-4">Distribuição por tipo processual</SectionTitle>
          <TipoChart data={data.distribuicao_por_tipo} />
        </article>
      </section>
    </div>
  );
}

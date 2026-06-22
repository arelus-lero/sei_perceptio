import { Clock, FileStack, Layers, Timer } from 'lucide-react';
import type { ReactNode } from 'react';

import { SeiTerm } from '@/components/glossary/sei-term';
import { cn } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

interface StatsCardsProps {
  data: Pick<
    DashboardData,
    'total_processos' | 'tempo_medio_tramitacao_dias' | 'contagem_por_status'
  >;
  className?: string;
}

function sumStatus(
  items: DashboardData['contagem_por_status'],
  statuses: DashboardData['contagem_por_status'][number]['status'][],
): number {
  return items
    .filter((item) => statuses.includes(item.status))
    .reduce((sum, item) => sum + item.total, 0);
}

interface StatCard {
  id: string;
  label: ReactNode;
  value: string;
  hint: ReactNode;
  icon: typeof FileStack;
}

export function StatsCards({ data, className }: StatsCardsProps) {
  const emTramitacao = sumStatus(data.contagem_por_status, [
    'aberto',
    'em_tramitacao',
  ]);
  const concluidos = sumStatus(data.contagem_por_status, [
    'concluido',
    'arquivado',
  ]);

  const cards: StatCard[] = [
    {
      id: 'total-processos',
      label: 'Total de processos',
      value: data.total_processos.toLocaleString('pt-BR'),
      hint: (
        <>
          Processos visíveis no órgão (exceto{' '}
          <SeiTerm term="sigilo">sigilosos</SeiTerm>)
        </>
      ),
      icon: FileStack,
    },
    {
      id: 'em-tramitacao',
      label: (
        <>
          Em <SeiTerm term="tramitacao">tramitação</SeiTerm>
        </>
      ),
      value: emTramitacao.toLocaleString('pt-BR'),
      hint: (
        <>
          Abertos ou em <SeiTerm term="tramitacao" definitionOnly>tramitação</SeiTerm>
        </>
      ),
      icon: Layers,
    },
    {
      id: 'concluidos-arquivados',
      label: 'Concluídos / arquivados',
      value: concluidos.toLocaleString('pt-BR'),
      hint: 'Processos finalizados',
      icon: Clock,
    },
    {
      id: 'tempo-medio-tramitacao',
      label: (
        <>
          Tempo médio de <SeiTerm term="tramitacao">tramitação</SeiTerm>
        </>
      ),
      value: `${data.tempo_medio_tramitacao_dias} dias`,
      hint: 'Média desde a geração até conclusão ou hoje',
      icon: Timer,
    },
  ];

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {cards.map((card) => (
        <article
          key={card.id}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="text-2xl font-semibold tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.hint}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <card.icon className="size-4" aria-hidden />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

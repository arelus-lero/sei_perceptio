'use client';

import { BellRing, Loader2 } from 'lucide-react';

import { AlertItem } from '@/components/monitoring/alert-item';
import { AlertBadge } from '@/components/monitoring/alert-badge';
import { SeiTerm } from '@/components/glossary/sei-term';
import { PageTitle, SectionTitle } from '@/components/layout/headings';
import { Button } from '@/components/ui/button';
import { useMonitoring } from '@/hooks/use-monitoring';

const STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_tramitacao: 'Em tramitação',
  concluido: 'Concluído',
  arquivado: 'Arquivado',
};

export default function MonitoramentoPage() {
  const {
    alertas,
    monitoramentos,
    totalNaoLidos,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useMonitoring();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" aria-hidden />
            <PageTitle>
              <SeiTerm term="monitoramento">Monitoramento</SeiTerm>
            </PageTitle>
            <AlertBadge count={totalNaoLidos} />
          </div>
          <p className="text-sm text-muted-foreground">
            Acompanhe processos <SeiTerm term="sei">SEI</SeiTerm> e receba alertas
            in-app sobre novos <SeiTerm term="andamento">andamentos</SeiTerm> e
            alterações de status.
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            Atualizar
          </Button>
          {totalNaoLidos > 0 ? (
            <Button type="button" variant="secondary" onClick={() => void markAllAsRead()}>
              Marcar todos como lidos
            </Button>
          ) : null}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Carregando monitoramento...
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <SectionTitle>Processos monitorados</SectionTitle>
        {monitoramentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum processo monitorado. Registre um processo pela API{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              POST /api/processos/[nup]/monitor
            </code>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {monitoramentos.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm font-medium">{item.nup}</p>
                  <p className="text-xs text-muted-foreground">
                    {STATUS_LABELS[item.status] ?? item.status} · {item.unidade_atual}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Verificação a cada {item.intervalo_verificacao}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle>Alertas</SectionTitle>
        {alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum alerta registrado. Alterações detectadas via snapshots (RF-008) geram
            notificações aqui em tempo real.
          </p>
        ) : (
          <div className="space-y-3">
            {alertas.map((alerta) => (
              <AlertItem
                key={alerta.id}
                alerta={alerta}
                onMarkRead={(id) => void markAsRead(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

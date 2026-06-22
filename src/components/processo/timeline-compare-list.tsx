'use client';

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { TimelineCompareProcesso, TimelineMarco } from '@/types/timeline';

const TIPO_LABELS: Record<string, string> = {
  recebimento: 'Recebimento',
  remessa: 'Remessa',
  conclusao: 'Conclusão',
  reabertura: 'Reabertura',
  anexacao: 'Anexação',
  desanexacao: 'Desanexação',
  distribuicao: 'Distribuição',
  consulta_publica: 'Consulta pública',
};

const MARCO_LABELS: Record<TimelineMarco, string> = {
  distribuicao: 'Distribuição',
  conclusao: 'Conclusão',
  anexacao: 'Anexação',
  consulta_publica: 'Consulta pública',
};

function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

interface TimelineCompareListProps {
  processos: TimelineCompareProcesso[];
}

export function TimelineCompareList({ processos }: TimelineCompareListProps) {
  const total = processos.reduce((sum, processo) => sum + processo.eventos.length, 0);

  if (total === 0) {
    return (
      <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Nenhum evento para exibir na comparação.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[640px] rounded-xl border border-border">
      <div className="space-y-8 p-6">
        {processos.map((processo) => (
          <section key={processo.processo_id} className="space-y-3">
            <header className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
              <span
                className="size-3 rounded-full"
                style={{ background: processo.cor }}
                aria-hidden
              />
          <p className="font-mono text-sm font-semibold" title={processo.nup}>
            {processo.nup}
          </p>
              <Badge variant="outline">{processo.tipo_processo_desc}</Badge>
              <span className="text-xs text-muted-foreground">
                {processo.eventos.length} evento(s)
              </span>
            </header>

            {processo.eventos.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sem eventos para os filtros atuais.
              </p>
            ) : (
              <ul className="space-y-2">
                {processo.eventos.map((evento) => (
                  <li
                    key={`${processo.processo_id}-${evento.id}`}
                    className={cn(
                      'rounded-lg border p-3 text-sm',
                      evento.destaque
                        ? 'border-primary/25 bg-primary/5'
                        : 'border-border bg-card',
                    )}
                    style={{ borderLeftWidth: 3, borderLeftColor: processo.cor }}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={evento.destaque ? 'default' : 'outline'}>
                        {TIPO_LABELS[evento.tipo] ?? evento.tipo}
                      </Badge>
                      {evento.marco ? (
                        <Badge variant="secondary">{MARCO_LABELS[evento.marco]}</Badge>
                      ) : null}
                      <time className="text-xs text-muted-foreground" dateTime={evento.data_hora}>
                        {formatDateTime(evento.data_hora)}
                      </time>
                    </div>
                    <p className="leading-relaxed">{evento.descricao}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}

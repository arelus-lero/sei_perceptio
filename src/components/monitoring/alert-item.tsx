import {
  Bell,
  GitBranch,
  Paperclip,
  RefreshCw,
  Scale,
  Timer,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AlertaListItem } from '@/types/monitoring';

interface AlertItemProps {
  alerta: AlertaListItem;
  onMarkRead?: (alertaId: string) => void;
  className?: string;
}

const EVENT_LABELS: Record<AlertaListItem['tipo_evento'], string> = {
  novo_andamento: 'Novo andamento',
  alteracao_status: 'Alteração de status',
  prazo_proximo: 'Prazo próximo',
  anexacao: 'Anexação',
  distribuicao: 'Distribuição',
};

function EventIcon({ tipo }: { tipo: AlertaListItem['tipo_evento'] }) {
  switch (tipo) {
    case 'novo_andamento':
      return <RefreshCw className="size-4" aria-hidden />;
    case 'alteracao_status':
      return <GitBranch className="size-4" aria-hidden />;
    case 'prazo_proximo':
      return <Timer className="size-4" aria-hidden />;
    case 'anexacao':
      return <Paperclip className="size-4" aria-hidden />;
    case 'distribuicao':
      return <Scale className="size-4" aria-hidden />;
    default:
      return <Bell className="size-4" aria-hidden />;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AlertItem({ alerta, onMarkRead, className }: AlertItemProps) {
  return (
    <article
      className={cn(
        'flex gap-3 rounded-lg border border-border p-4 transition-colors',
        !alerta.lido && 'border-primary/30 bg-primary/5',
        className,
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md',
          alerta.lido ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
        )}
      >
        <EventIcon tipo={alerta.tipo_evento} />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={alerta.lido ? 'outline' : 'default'}>
            {EVENT_LABELS[alerta.tipo_evento]}
          </Badge>
          {alerta.nup ? (
            <span className="font-mono text-xs text-muted-foreground">{alerta.nup}</span>
          ) : null}
          <time className="text-xs text-muted-foreground" dateTime={alerta.data_criacao}>
            {formatDateTime(alerta.data_criacao)}
          </time>
        </div>

        <p className="text-sm leading-relaxed text-foreground">{alerta.descricao}</p>

        {!alerta.lido && onMarkRead ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onMarkRead(alerta.id)}
          >
            Marcar como lido
          </Button>
        ) : null}
      </div>
    </article>
  );
}

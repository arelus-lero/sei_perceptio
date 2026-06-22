import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { processoHref } from '@/lib/utils/processo-url';
import { cn } from '@/lib/utils';
import type { AtividadeRecente } from '@/types/dashboard';

interface AtividadeRecenteListProps {
  atividades: AtividadeRecente[];
  className?: string;
}

const TIPO_LABELS: Record<AtividadeRecente['tipo'], string> = {
  recebimento: 'Recebimento',
  remessa: 'Remessa',
  conclusao: 'Conclusão',
  reabertura: 'Reabertura',
  anexacao: 'Anexação',
  desanexacao: 'Desanexação',
  distribuicao: 'Distribuição',
};

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

export function AtividadeRecenteList({
  atividades,
  className,
}: AtividadeRecenteListProps) {
  if (atividades.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Nenhum andamento recente registrado.
      </p>
    );
  }

  return (
    <ul className={cn('divide-y divide-border rounded-lg border border-border', className)}>
      {atividades.map((item) => (
        <li key={item.id}>
          <Link
            href={processoHref(item.nup)}
            className="block space-y-2 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{TIPO_LABELS[item.tipo]}</Badge>
              <span className="font-mono text-xs text-muted-foreground">{item.nup}</span>
              <time className="text-xs text-muted-foreground" dateTime={item.data_hora}>
                {formatDateTime(item.data_hora)}
              </time>
            </div>
            <p className="line-clamp-2 text-sm text-foreground">{item.descricao}</p>
            <p className="text-xs text-muted-foreground">{item.unidade}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

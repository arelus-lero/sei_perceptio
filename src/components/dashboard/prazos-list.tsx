import Link from 'next/link';

import { SeiTerm } from '@/components/glossary/sei-term';
import { Badge } from '@/components/ui/badge';
import { processoHref } from '@/lib/utils/processo-url';
import { cn } from '@/lib/utils';
import type { PrazoProximo } from '@/types/dashboard';

interface PrazosListProps {
  prazos: PrazoProximo[];
  className?: string;
}

function formatDateBr(isoDate: string): string {
  try {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return isoDate;
  }
}

function urgencyVariant(
  dias: number,
): 'default' | 'secondary' | 'outline' {
  if (dias <= 3) {
    return 'default';
  }
  if (dias <= 7) {
    return 'secondary';
  }
  return 'outline';
}

export function PrazosList({ prazos, className }: PrazosListProps) {
  if (prazos.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Nenhuma <SeiTerm term="consulta_publica">consulta pública</SeiTerm> com
        encerramento nos próximos dias.
      </p>
    );
  }

  return (
    <ul className={cn('divide-y divide-border rounded-lg border border-border', className)}>
      {prazos.map((prazo) => (
        <li key={`${prazo.processo_id}-${prazo.data_encerramento}`}>
          <Link
            href={processoHref(prazo.nup)}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-sm font-medium">{prazo.nup}</p>
              <p className="text-xs text-muted-foreground">
                Encerramento em {formatDateBr(prazo.data_encerramento)}
              </p>
            </div>
            <Badge variant={urgencyVariant(prazo.dias_restantes)}>
              {prazo.dias_restantes === 0
                ? 'Encerra hoje'
                : `${prazo.dias_restantes} dia(s)`}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ChatConfidence } from '@/types/chat';

const NIVEL_LABELS: Record<ChatConfidence['nivel'], string> = {
  alto: 'alta',
  medio: 'média',
  baixo: 'baixa',
};

function confidenceBadgeClass(nivel: ChatConfidence['nivel']): string {
  switch (nivel) {
    case 'baixo':
      return 'border-destructive/50 bg-destructive/15 text-destructive font-semibold shadow-sm ring-1 ring-destructive/25';
    case 'medio':
      return 'border-amber-500/50 bg-amber-500/15 text-amber-900 font-medium dark:text-amber-100';
    case 'alto':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300';
  }
}

function confidenceSegmentColor(nivel: ChatConfidence['nivel']): string {
  switch (nivel) {
    case 'baixo':
      return 'bg-destructive';
    case 'medio':
      return 'bg-amber-500';
    case 'alto':
      return 'bg-emerald-600 dark:bg-emerald-500';
  }
}

function ConfidenceLevelIndicator({ nivel }: { nivel: ChatConfidence['nivel'] }) {
  const filledCount = nivel === 'alto' ? 3 : nivel === 'medio' ? 2 : 1;
  const activeColor = confidenceSegmentColor(nivel);

  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {([1, 2, 3] as const).map((segment) => (
        <span
          key={segment}
          className={cn(
            'h-2 w-3 rounded-sm',
            segment <= filledCount ? activeColor : 'bg-current/25',
          )}
        />
      ))}
    </span>
  );
}

interface ConfidenceBadgeProps {
  item: ChatConfidence;
}

export function ConfidenceBadge({ item }: ConfidenceBadgeProps) {
  const nivelLabel = NIVEL_LABELS[item.nivel];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors md:min-h-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            confidenceBadgeClass(item.nivel),
          )}
          aria-label={`Confiança: ${nivelLabel}. Afirmação verificada: ${item.afirmacao}`}
        >
          <ConfidenceLevelIndicator nivel={item.nivel} />
          <span>{nivelLabel}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm text-left">
        <p className="text-xs font-semibold opacity-80">Afirmação verificada</p>
        <p className="text-sm">{item.afirmacao}</p>
      </TooltipContent>
    </Tooltip>
  );
}

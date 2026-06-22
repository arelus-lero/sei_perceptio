'use client';

import type { ReactNode } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getSeiGlossaryEntry, type SeiTermKey } from '@/lib/glossary/sei-terms';
import { cn } from '@/lib/utils';

interface SeiTermProps {
  term: SeiTermKey;
  children?: ReactNode;
  className?: string;
  /** Exibir apenas a definição no tooltip, sem repetir o título */
  definitionOnly?: boolean;
}

export function SeiTerm({
  term,
  children,
  className,
  definitionOnly = false,
}: SeiTermProps) {
  const entry = getSeiGlossaryEntry(term);
  const label = children ?? entry.shortLabel ?? entry.term;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'cursor-help border-b border-dotted border-muted-foreground/50 decoration-clone',
            className,
          )}
          tabIndex={0}
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {!definitionOnly ? (
          <p className="text-sm font-medium leading-snug">{entry.term}</p>
        ) : null}
        <p
          className={cn(
            'text-xs leading-relaxed text-background/80',
            !definitionOnly && 'mt-1',
          )}
        >
          {entry.definition}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

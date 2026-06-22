'use client';

import { type KeyboardEvent, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { SeiTerm } from '@/components/glossary/sei-term';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ChatCitation } from '@/types/chat';

interface CitationCardProps {
  citation: ChatCitation;
  className?: string;
  onSelectSource?: (sourceId: string) => void;
}

export function CitationCard({
  citation,
  className,
  onSelectSource,
}: CitationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  const handleToggle = () => {
    setExpanded((value) => !value);
    onSelectSource?.(citation.source_id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-controls={contentId}
      className={cn(
        'cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
    >
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs font-medium">
              <span className="text-muted-foreground">
                <SeiTerm term="numero_sei">Nº SEI</SeiTerm>:{' '}
              </span>
              {citation.numero_sei}
            </p>
            <p className="text-xs text-muted-foreground">
              {citation.tipo} · {citation.unidade}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary">
              {citation.score.toFixed(2)}
            </Badge>
            <ChevronDown
              aria-hidden
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                expanded && 'rotate-180',
              )}
            />
          </div>
        </div>
        <p
          id={contentId}
          className={cn(
            'text-xs leading-relaxed text-muted-foreground',
            !expanded && 'line-clamp-2',
          )}
        >
          {citation.trecho}
        </p>
      </CardContent>
    </Card>
  );
}

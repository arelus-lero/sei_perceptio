'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BookOpen, Share2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { NotebookListItem } from '@/types/notebook';

interface NotebookCardProps {
  notebook: NotebookListItem;
  className?: string;
}

export function NotebookCard({ notebook, className }: NotebookCardProps) {
  const createdLabel = formatDistanceToNow(new Date(notebook.data_criacao), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Link href={`/notebooks/${notebook.id}`} className={cn('block', className)}>
      <Card className="transition-colors hover:bg-muted/40">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              {notebook.nome}
            </CardTitle>
            {notebook.descricao ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {notebook.descricao}
              </p>
            ) : null}
          </div>
          {notebook.compartilhado ? (
            <Badge variant="outline" className="shrink-0 gap-1">
              <Share2 className="size-3" />
              Compartilhado
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{notebook.fontes_count} fonte(s)</span>
          <span>Criado {createdLabel}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

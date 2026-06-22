'use client';

import { Loader2 } from 'lucide-react';

import { TagBadge } from '@/components/tags/tag-badge';
import { cn } from '@/lib/utils';
import type { TagItem } from '@/types/tag';

interface TagFilterProps {
  tags: TagItem[];
  activeTagIds: string[];
  onToggle: (tagId: string) => void;
  loading?: boolean;
  error?: string | null;
  className?: string;
  label?: string;
}

export function TagFilter({
  tags,
  activeTagIds,
  onToggle,
  loading = false,
  error = null,
  className,
  label = 'Filtrar por tags',
}: TagFilterProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && tags.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma tag cadastrada no órgão.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const selected = activeTagIds.includes(tag.id);
            return (
              <TagBadge
                key={tag.id}
                tag={tag}
                selected={selected}
                onClick={() => onToggle(tag.id)}
              />
            );
          })}
        </div>
      )}

      {activeTagIds.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {activeTagIds.length} tag(s) ativa(s) no filtro RAG.
        </p>
      ) : null}
    </div>
  );
}

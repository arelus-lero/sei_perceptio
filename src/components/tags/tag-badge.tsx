import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TagItem } from '@/types/tag';

interface TagBadgeProps {
  tag: Pick<TagItem, 'id' | 'nome' | 'cor'>;
  selected?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

function contrastTextColor(hex: string): string {
  const normalized = hex.replace('#', '');
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
}

export function TagBadge({
  tag,
  selected = false,
  onRemove,
  onClick,
  className,
}: TagBadgeProps) {
  const textColor = contrastTextColor(tag.cor);
  const interactive = Boolean(onClick);

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        interactive && 'cursor-pointer transition-opacity hover:opacity-90',
        selected && 'ring-2 ring-primary ring-offset-1',
        className,
      )}
      style={{ backgroundColor: tag.cor, color: textColor }}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="truncate">{tag.nome}</span>
      {onRemove ? (
        <button
          type="button"
          className="rounded-full p-0.5 hover:bg-black/10"
          aria-label={`Remover tag ${tag.nome}`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

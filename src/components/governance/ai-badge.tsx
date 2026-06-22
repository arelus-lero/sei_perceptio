import { cn } from '@/lib/utils';
import { IA_DECLARATION } from '@/lib/rag/prompts/system';

interface AiBadgeProps {
  className?: string;
}

export function AiBadge({ className }: AiBadgeProps) {
  return (
    <p
      className={cn(
        'mt-3 border-l-2 border-amber-500/60 pl-3 text-xs leading-relaxed text-muted-foreground',
        className,
      )}
      aria-label="Declaração de uso de IA"
    >
      {IA_DECLARATION}
    </p>
  );
}

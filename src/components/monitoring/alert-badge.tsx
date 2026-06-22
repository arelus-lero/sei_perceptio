import { cn } from '@/lib/utils';

interface AlertBadgeProps {
  count: number;
  className?: string;
}

export function AlertBadge({ count, className }: AlertBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const label = count > 99 ? '99+' : String(count);

  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white',
        className,
      )}
      aria-label={`${count} alertas não lidos`}
    >
      {label}
    </span>
  );
}

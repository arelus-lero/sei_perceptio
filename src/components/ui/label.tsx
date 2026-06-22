import { cn } from '@/lib/utils';

type LabelProps = React.ComponentProps<'label'>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    />
  );
}

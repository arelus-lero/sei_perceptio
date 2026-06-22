import { cn } from '@/lib/utils';

type ScrollAreaProps = React.ComponentProps<'div'>;

export function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      className={cn('overflow-y-auto', className)}
      {...props}
    >
      {children}
    </div>
  );
}

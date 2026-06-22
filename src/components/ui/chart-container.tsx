'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function ChartContainer({ className, style, children }: ChartContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn('min-h-0 min-w-0 w-full', className)} style={style}>
      {mounted ? children : <Skeleton className="h-full min-h-[inherit] w-full" aria-hidden />}
    </div>
  );
}

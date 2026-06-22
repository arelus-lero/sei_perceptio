import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const pageTitleClassName = 'text-2xl font-semibold tracking-tight';
export const sectionTitleClassName = 'text-lg font-semibold';
export const subsectionTitleClassName = 'text-base font-medium';

interface HeadingProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function PageTitle({ children, className, id }: HeadingProps) {
  return (
    <h1 id={id} className={cn(pageTitleClassName, className)}>
      {children}
    </h1>
  );
}

export function SectionTitle({ children, className, id }: HeadingProps) {
  return (
    <h2 id={id} className={cn(sectionTitleClassName, className)}>
      {children}
    </h2>
  );
}

export function SubsectionTitle({ children, className, id }: HeadingProps) {
  return (
    <h3 id={id} className={cn(subsectionTitleClassName, className)}>
      {children}
    </h3>
  );
}

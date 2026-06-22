import { GitBranch } from 'lucide-react';

import { PageTitle } from '@/components/layout/headings';
import { Skeleton } from '@/components/ui/skeleton';

export function TimelinePageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6"
      aria-busy="true"
      aria-label="Carregando linha do tempo"
    >
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GitBranch className="size-5 text-primary" aria-hidden />
          <PageTitle>
            <Skeleton className="h-8 w-72" />
          </PageTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-44 font-mono" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full max-w-lg" />
      </header>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-4 flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-[480px] w-full rounded-lg" />
      </div>
    </div>
  );
}

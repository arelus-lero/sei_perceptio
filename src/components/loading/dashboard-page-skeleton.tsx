import { LayoutDashboard } from 'lucide-react';

import { SectionTitle } from '@/components/layout/headings';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-6" aria-busy="true">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="size-5 text-primary" aria-hidden />
          <Skeleton className="h-8 w-56" />
        </div>
        <Skeleton className="h-4 w-full max-w-xl" />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <article
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="size-9 rounded-lg" />
            </div>
          </article>
        ))}
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <article
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <SectionTitle className="mb-4">
              <Skeleton className="h-6 w-40" />
            </SectionTitle>
            <Skeleton className="h-72 w-full rounded-lg" />
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <article
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <SectionTitle className="mb-4">
              <Skeleton className="h-6 w-36" />
            </SectionTitle>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section>
        <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <SectionTitle className="mb-4">
            <Skeleton className="h-6 w-52" />
          </SectionTitle>
          <Skeleton className="h-96 w-full rounded-lg" />
        </article>
      </section>
    </div>
  );
}

import { PageTitle } from '@/components/layout/headings';
import { Skeleton } from '@/components/ui/skeleton';

export function NotebooksPageSkeleton() {
  return (
    <div
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6"
      aria-busy="true"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <PageTitle>
            <Skeleton className="h-8 w-40" />
          </PageTitle>
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <article
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-24" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

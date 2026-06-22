import { Skeleton } from '@/components/ui/skeleton';

export function ChatMessagesSkeleton() {
  return (
    <div
      className="space-y-4 py-4"
      aria-busy="true"
      aria-label="Carregando mensagens"
    >
      <div className="flex justify-end">
        <Skeleton className="h-16 w-[min(100%,18rem)] rounded-xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-24 w-[min(100%,22rem)] rounded-xl" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-12 w-[min(100%,14rem)] rounded-xl" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-20 w-[min(100%,20rem)] rounded-xl" />
      </div>
    </div>
  );
}

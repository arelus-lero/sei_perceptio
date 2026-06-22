'use client';

import { useEffect } from 'react';

import { ErrorRecoveryCard } from '@/components/error/error-recovery-card';

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('[dashboard-error]', error);
    // TODO: integrar observabilidade (Sentry/Datadog)
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <ErrorRecoveryCard onRetry={reset} />
    </div>
  );
}

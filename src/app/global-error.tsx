'use client';

import { useEffect } from 'react';

import { ErrorRecoveryCard } from '@/components/error/error-recovery-card';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[global-error]', error);
    // TODO: integrar observabilidade (Sentry/Datadog)
  }, [error]);

  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <main className="flex flex-1 items-center justify-center p-6">
          <ErrorRecoveryCard onRetry={reset} />
        </main>
      </body>
    </html>
  );
}

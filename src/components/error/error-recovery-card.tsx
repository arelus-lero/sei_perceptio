'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageTitle } from '@/components/layout/headings';
import { cn } from '@/lib/utils';

interface ErrorRecoveryCardProps {
  onRetry?: () => void;
  compact?: boolean;
  title?: string;
  message?: string;
  className?: string;
  showHomeLink?: boolean;
}

export function ErrorRecoveryCard({
  onRetry,
  compact = false,
  title = 'Algo deu errado',
  message = 'Ocorreu um erro inesperado ao carregar esta página. Tente novamente ou retorne ao início.',
  className,
  showHomeLink = true,
}: ErrorRecoveryCardProps) {
  return (
    <Card
      className={cn(
        'border-destructive/30 bg-destructive/5',
        compact ? 'max-w-md' : 'mx-auto w-full max-w-lg',
        className,
      )}
    >
      <CardContent className={cn(compact ? 'space-y-3 p-4' : 'space-y-4 p-6')}>
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={cn('shrink-0 text-destructive', compact ? 'size-4' : 'size-5')}
            aria-hidden
          />
          <div className="space-y-1">
            {compact ? (
              <p className="text-sm font-semibold text-foreground">{title}</p>
            ) : (
              <PageTitle>{title}</PageTitle>
            )}
            <p
              className={cn(
                'text-muted-foreground',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              {message}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {onRetry ? (
            <Button type="button" size={compact ? 'sm' : 'default'} onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
          {showHomeLink ? (
            <Button asChild variant="outline" size={compact ? 'sm' : 'default'}>
              <Link href="/dashboard">Voltar ao início</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

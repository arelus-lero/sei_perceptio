'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  EMBEDDING_FAILURE_MESSAGE,
  FONT_STATUS_LABELS,
  isEmbeddingDegradedStatus,
  readFonteIngestionStatus,
} from '@/lib/ingestion/ingestion-status';
import { cn } from '@/lib/utils';
import type { FonteIngestionStatus } from '@/types/ingestion';

interface FonteIngestionStatusProps {
  status: FonteIngestionStatus;
  className?: string;
}

export function FonteIngestionStatusBadge({ status, className }: FonteIngestionStatusProps) {
  if (status === 'pronto') {
    return null;
  }

  const label = FONT_STATUS_LABELS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
        status === 'processando' && 'bg-muted text-muted-foreground',
        status === 'requer_ocr' && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
        status === 'erro' && 'bg-destructive/10 text-destructive',
        status === 'erro_embeddings' && 'bg-destructive/10 text-destructive',
        className,
      )}
    >
      {label}
    </span>
  );
}

interface FonteReembedButtonProps {
  fonteId: string;
  status: FonteIngestionStatus;
  disabled?: boolean;
  onReembedStarted?: () => void;
  className?: string;
}

export function FonteReembedButton({
  fonteId,
  status,
  disabled = false,
  onReembedStarted,
  className,
}: FonteReembedButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!isEmbeddingDegradedStatus(status)) {
    return null;
  }

  async function handleReembed() {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/ingest/reembed/${fonteId}`, { method: 'POST' });
      const payload = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string' ? payload.error : `Erro ${response.status}`,
        );
      }

      onReembedStarted?.();
    } catch (error) {
      console.error('[FonteReembedButton]', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs text-destructive">{EMBEDDING_FAILURE_MESSAGE}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || isLoading}
        onClick={() => void handleReembed()}
      >
        <RefreshCw className={cn(isLoading && 'animate-spin')} aria-hidden />
        Tentar novamente
      </Button>
    </div>
  );
}

export function readFonteStatusFromMetadados(
  metadados: Record<string, unknown> | null | undefined,
): FonteIngestionStatus {
  return readFonteIngestionStatus(metadados);
}

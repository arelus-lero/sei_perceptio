'use client';

import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  computeMajorPhaseProgress,
  INGESTION_STAGE_LABELS,
  resolveIngestionMajorPhase,
  resolveIngestionProgressLabel,
  type IngestionMajorPhase,
  type IngestionStatusSnapshot,
} from '@/lib/ingestion/ingestion-status';
import { cn } from '@/lib/utils';
import type { IngestionJobStage } from '@/types/ingestion';

export const INGESTION_MAJOR_PHASE_LABELS: Record<
  Exclude<IngestionMajorPhase, 'error'>,
  string
> = {
  uploading: 'Enviando',
  extracting: 'Extraindo texto',
  embedding: 'Gerando embeddings',
  completed: 'Concluído',
};

export const INGESTION_MAJOR_PHASE_ORDER: Exclude<IngestionMajorPhase, 'error'>[] = [
  'uploading',
  'extracting',
  'embedding',
  'completed',
];

export interface IngestionProgressState {
  snapshot: IngestionStatusSnapshot;
  phase: IngestionMajorPhase;
  label: string;
  attempt: number;
  maxAttempts: number;
  timedOut?: boolean;
}

export function buildIngestionProgressState(
  snapshot: IngestionStatusSnapshot,
  attempt: number,
  maxAttempts: number,
  timedOut = false,
): IngestionProgressState {
  const phase = timedOut ? 'error' : resolveIngestionMajorPhase(snapshot);
  const label = timedOut
    ? 'Tempo esgotado aguardando conclusão da ingestão'
    : resolveIngestionProgressLabel(snapshot);

  return {
    snapshot,
    phase,
    label,
    attempt,
    maxAttempts,
    timedOut,
  };
}

export function buildUploadingProgressState(maxAttempts: number): IngestionProgressState {
  const snapshot: IngestionStatusSnapshot = {
    fonte_id: '',
    status: 'processando',
    ingestion_job: { stage: 'enqueued' },
  };

  return {
    snapshot,
    phase: 'uploading',
    label: INGESTION_STAGE_LABELS.enqueued,
    attempt: 0,
    maxAttempts,
  };
}

interface SourceIngestionProgressProps {
  state: IngestionProgressState;
  className?: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
}

function IndeterminateProgressBar({
  className,
  'aria-label': ariaLabel,
}: {
  className?: string;
  'aria-label': string;
}) {
  return (
    <div
      role="progressbar"
      aria-busy="true"
      aria-label={ariaLabel}
      className={cn(
        'relative h-1 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
    >
      <div
        className="h-full w-1/3 bg-primary animate-[progress-slide_1.4s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:opacity-70"
        aria-hidden
      />
    </div>
  );
}

export function SourceIngestionProgress({
  state,
  className,
  onRetry,
  retryDisabled = false,
}: SourceIngestionProgressProps) {
  const progressValue = computeMajorPhaseProgress(
    state.phase === 'error' ? 'extracting' : state.phase,
    state.attempt,
    state.maxAttempts,
  );
  const indeterminate =
    state.phase === 'uploading' && state.attempt === 0 && !state.timedOut;
  const progressLabel = `Progresso da ingestão: ${state.label}`;
  const stage = state.snapshot.ingestion_job?.stage;
  const stageLabel =
    stage && stage in INGESTION_STAGE_LABELS
      ? INGESTION_STAGE_LABELS[stage as IngestionJobStage]
      : null;

  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border border-border bg-muted/40 p-3',
        state.phase === 'error' && 'border-destructive/40 bg-destructive/5',
        className,
      )}
      role="status"
    >
      <p
        className={cn(
          'text-sm font-medium',
          state.phase === 'error' ? 'text-destructive' : 'text-foreground',
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {state.label}
      </p>

      {stageLabel && state.phase !== 'error' && state.phase !== 'completed' ? (
        <p className="text-xs text-muted-foreground">
          Estágio: <span className="font-medium text-foreground">{stageLabel}</span>
        </p>
      ) : null}

      {state.phase === 'error' ? (
        <IndeterminateProgressBar aria-label={progressLabel} className="opacity-50" />
      ) : indeterminate ? (
        <IndeterminateProgressBar aria-label={progressLabel} />
      ) : (
        <Progress value={progressValue} aria-label={progressLabel} />
      )}

      {state.phase !== 'error' ? (
        <p className="text-xs text-muted-foreground">
          {INGESTION_MAJOR_PHASE_ORDER.map((phase, index) => (
            <span key={phase}>
              <span
                className={cn(
                  phase === state.phase && 'font-semibold text-foreground',
                  INGESTION_MAJOR_PHASE_ORDER.indexOf(
                    state.phase as Exclude<IngestionMajorPhase, 'error'>,
                  ) > index && 'text-foreground/80',
                )}
              >
                {INGESTION_MAJOR_PHASE_LABELS[phase]}
              </span>
              {index < INGESTION_MAJOR_PHASE_ORDER.length - 1 ? (
                <span className="text-muted-foreground/60" aria-hidden> → </span>
              ) : null}
            </span>
          ))}
        </p>
      ) : null}

      {state.phase === 'error' && onRetry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retryDisabled}
          onClick={onRetry}
        >
          <RefreshCw aria-hidden />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

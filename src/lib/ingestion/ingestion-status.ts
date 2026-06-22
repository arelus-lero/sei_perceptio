import type {
  FonteIngestionStatus,
  IngestionJobStage,
  IngestionJobState,
} from '@/types/ingestion';

export interface IngestionStatusSnapshot {
  fonte_id: string;
  status: FonteIngestionStatus;
  ingestion_job: IngestionJobState | null;
  checksum?: string | null;
  chunks_indexed?: number;
}

export const EMBEDDING_FAILURE_MESSAGE =
  'Falha ao gerar embeddings — fonte não pesquisável. Tentar novamente.';

/** Rótulos alinhados aos estágios gravados em `metadados_json.ingestion_job.stage`. */
export const INGESTION_STAGE_LABELS: Record<IngestionJobStage, string> = {
  enqueued: 'Enviando',
  extraction: 'Extraindo texto',
  anonymization: 'Anonimizando conteúdo',
  deduplication: 'Verificando duplicatas',
  chunking: 'Dividindo em chunks',
  embedding: 'Gerando embeddings',
  indexing: 'Indexando chunks',
  completed: 'Concluído',
  failed: 'Falha na ingestão',
};

export const FONT_STATUS_LABELS: Record<FonteIngestionStatus, string> = {
  processando: 'Processando',
  pronto: 'Concluído',
  requer_ocr: 'OCR necessário',
  erro: 'Falha na ingestão',
  erro_embeddings: 'Embeddings indisponíveis',
};

export function readFonteIngestionStatus(
  metadados: Record<string, unknown> | null | undefined,
): FonteIngestionStatus {
  const raw = metadados?.status;
  if (
    raw === 'pronto'
    || raw === 'requer_ocr'
    || raw === 'erro'
    || raw === 'erro_embeddings'
    || raw === 'processando'
  ) {
    return raw;
  }

  return 'processando';
}

export function readIngestionJob(
  metadados: Record<string, unknown> | null | undefined,
): IngestionJobState | null {
  const jobRaw = metadados?.ingestion_job;
  return jobRaw && typeof jobRaw === 'object' ? (jobRaw as IngestionJobState) : null;
}

const EXTRACTION_STAGES: ReadonlySet<IngestionJobStage> = new Set([
  'extraction',
  'anonymization',
  'deduplication',
  'chunking',
]);

const EMBEDDING_STAGES: ReadonlySet<IngestionJobStage> = new Set(['embedding', 'indexing']);

export function isTerminalIngestionSnapshot(snapshot: IngestionStatusSnapshot): boolean {
  const stage = snapshot.ingestion_job?.stage;

  if (
    snapshot.status === 'erro'
    || snapshot.status === 'erro_embeddings'
    || stage === 'failed'
  ) {
    return true;
  }

  if (snapshot.status === 'pronto' || snapshot.status === 'requer_ocr') {
    return true;
  }

  return stage === 'completed';
}

export function isIngestionFailure(snapshot: IngestionStatusSnapshot): boolean {
  return (
    snapshot.status === 'erro'
    || snapshot.status === 'erro_embeddings'
    || snapshot.ingestion_job?.stage === 'failed'
  );
}

export function isEmbeddingDegradedStatus(status: FonteIngestionStatus): boolean {
  return status === 'erro_embeddings';
}

export function resolveIngestionProgressLabel(snapshot: IngestionStatusSnapshot): string {
  const stage = snapshot.ingestion_job?.stage;

  if (snapshot.status === 'erro_embeddings') {
    const jobError = snapshot.ingestion_job?.error;
    if (typeof jobError === 'string' && jobError.trim().length > 0) {
      return `${EMBEDDING_FAILURE_MESSAGE} (${jobError})`;
    }
    return EMBEDDING_FAILURE_MESSAGE;
  }

  if (isIngestionFailure(snapshot)) {
    const jobError = snapshot.ingestion_job?.error;
    if (typeof jobError === 'string' && jobError.trim().length > 0) {
      return jobError;
    }
    return FONT_STATUS_LABELS.erro;
  }

  if (isTerminalIngestionSnapshot(snapshot)) {
    if (snapshot.status === 'requer_ocr') {
      return FONT_STATUS_LABELS.requer_ocr;
    }
    return FONT_STATUS_LABELS.pronto;
  }

  if (stage && stage in INGESTION_STAGE_LABELS) {
    return INGESTION_STAGE_LABELS[stage as IngestionJobStage];
  }

  return FONT_STATUS_LABELS.processando;
}

export type IngestionMajorPhase = 'uploading' | 'extracting' | 'embedding' | 'completed' | 'error';

export function resolveIngestionMajorPhase(snapshot: IngestionStatusSnapshot): IngestionMajorPhase {
  if (isIngestionFailure(snapshot)) {
    return 'error';
  }

  if (isTerminalIngestionSnapshot(snapshot)) {
    return 'completed';
  }

  const stage = snapshot.ingestion_job?.stage;

  if (!stage || stage === 'enqueued') {
    return 'uploading';
  }

  if (EXTRACTION_STAGES.has(stage)) {
    return 'extracting';
  }

  if (EMBEDDING_STAGES.has(stage)) {
    return 'embedding';
  }

  if (stage === 'completed') {
    return 'completed';
  }

  return 'uploading';
}

export function computeMajorPhaseProgress(
  phase: IngestionMajorPhase,
  attempt: number,
  maxAttempts: number,
): number {
  if (phase === 'completed') {
    return 100;
  }

  if (phase === 'error') {
    return 0;
  }

  const phaseOrder: IngestionMajorPhase[] = ['uploading', 'extracting', 'embedding', 'completed'];
  const phaseIndex = phaseOrder.indexOf(phase);
  const phaseBase = phaseIndex * 25;
  const attemptRatio = maxAttempts > 0 ? attempt / maxAttempts : 0;
  const withinPhase = Math.round(attemptRatio * 24);

  return Math.min(99, phaseBase + withinPhase);
}

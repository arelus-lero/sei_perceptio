export type FonteIngestionStatus =
  | 'processando'
  | 'pronto'
  | 'requer_ocr'
  | 'erro'
  | 'erro_embeddings';

export type UploadPipelineStage = 'storage' | 'extraction' | 'fonte' | 'ingestion';

export type IngestionJobStage =
  | 'enqueued'
  | 'extraction'
  | 'anonymization'
  | 'deduplication'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'failed';

export interface IngestionJobState {
  stage: IngestionJobStage;
  enqueued_at?: string;
  started_at?: string;
  updated_at?: string;
  error?: string | null;
  chunks_indexed?: number;
  embedding_available?: boolean;
}

export type AsyncJobType = 'ingestion' | 'monitoring' | 'retention';

export type AsyncJobStatus = 'enqueued' | 'running' | 'completed' | 'failed';

export interface AsyncJobSnapshot {
  job_id: string;
  job_type: AsyncJobType;
  status: AsyncJobStatus;
  created_at: string;
  updated_at: string;
  result?: Record<string, unknown>;
  error?: string | null;
}

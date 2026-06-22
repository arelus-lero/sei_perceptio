import type { UploadPipelineStage } from '@/types/ingestion';

const CLIENT_MESSAGES: Record<UploadPipelineStage, string> = {
  storage: 'Falha ao enviar o arquivo para o armazenamento.',
  extraction: 'Falha ao extrair texto do arquivo.',
  fonte: 'Falha ao registrar a fonte no notebook.',
  ingestion: 'Arquivo enviado, mas a indexação para busca falhou parcialmente.',
};

export class UploadPipelineError extends Error {
  readonly stage: UploadPipelineStage;
  readonly clientMessage: string;
  readonly httpStatus: number;

  constructor(stage: UploadPipelineStage, cause?: unknown, httpStatus = 500) {
    const internalMessage =
      cause instanceof Error ? cause.message : cause ? String(cause) : 'unknown error';

    super(`[upload:${stage}] ${internalMessage}`);
    this.name = 'UploadPipelineError';
    this.stage = stage;
    this.clientMessage = CLIENT_MESSAGES[stage];
    this.httpStatus = httpStatus;
  }
}

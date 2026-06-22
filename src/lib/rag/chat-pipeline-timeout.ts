/** RNF-001: alvo P95 ≤ 15s para resposta completa do chat */
export class ChatPipelineTimeoutError extends Error {
  readonly stage: string;
  readonly timeoutMs: number;

  constructor(stage: string, timeoutMs: number) {
    super(`Chat pipeline timeout at ${stage} after ${timeoutMs}ms`);
    this.name = 'ChatPipelineTimeoutError';
    this.stage = stage;
    this.timeoutMs = timeoutMs;
  }
}

export function getChatPipelineTimeoutMs(): number {
  const parsed = Number(process.env.CHAT_PIPELINE_TIMEOUT_MS ?? 15_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
}

export interface ChatPipelineDeadline {
  totalMs: number;
  remainingMs: () => number;
}

export function createChatPipelineDeadline(
  totalMs = getChatPipelineTimeoutMs(),
): ChatPipelineDeadline {
  const deadlineAt = Date.now() + totalMs;

  return {
    totalMs,
    remainingMs: () => Math.max(0, deadlineAt - Date.now()),
  };
}

export function isChatPipelineTimeoutError(error: unknown): error is ChatPipelineTimeoutError {
  return error instanceof ChatPipelineTimeoutError;
}

export async function withPipelineTimeout<T>(
  promise: Promise<T>,
  remainingMs: () => number,
  stage: string,
): Promise<T> {
  const ms = remainingMs();
  if (ms <= 0) {
    throw new ChatPipelineTimeoutError(stage, 0);
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new ChatPipelineTimeoutError(stage, ms));
        }, ms);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export function resolveStageTimeoutMs(
  remainingMs: () => number,
  preferredMs: number,
): number {
  return Math.min(Math.max(remainingMs(), 0), preferredMs);
}

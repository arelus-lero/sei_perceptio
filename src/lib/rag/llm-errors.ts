export type LlmErrorCode = 'LLM_TIMEOUT' | 'LLM_UNAVAILABLE' | 'LLM_CONFIG_MISSING';

export type LlmTimeoutKind = 'connection' | 'ttft' | 'pipeline' | 'stream';

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = 'LlmError';
    this.code = code;
  }
}

export class LlmTimeoutError extends LlmError {
  readonly timeoutKind: LlmTimeoutKind;
  readonly timeoutMs: number;
  readonly elapsedMs: number;

  constructor(
    message: string,
    timeoutKind: LlmTimeoutKind,
    timeoutMs: number,
    elapsedMs: number,
  ) {
    super('LLM_TIMEOUT', message);
    this.name = 'LlmTimeoutError';
    this.timeoutKind = timeoutKind;
    this.timeoutMs = timeoutMs;
    this.elapsedMs = elapsedMs;
  }
}

export class LlmConnectionTimeoutError extends LlmTimeoutError {
  constructor(timeoutMs: number, elapsedMs: number) {
    super(
      `LLM connection timed out after ${elapsedMs}ms (limit ${timeoutMs}ms)`,
      'connection',
      timeoutMs,
      elapsedMs,
    );
    this.name = 'LlmConnectionTimeoutError';
  }
}

export class LlmTtftTimeoutError extends LlmTimeoutError {
  constructor(timeoutMs: number, elapsedMs: number) {
    super(
      `LLM time-to-first-token exceeded ${elapsedMs}ms (limit ${timeoutMs}ms)`,
      'ttft',
      timeoutMs,
      elapsedMs,
    );
    this.name = 'LlmTtftTimeoutError';
  }
}

export class LlmStreamTimeoutError extends LlmTimeoutError {
  constructor(timeoutMs: number, elapsedMs: number) {
    super(
      `LLM stream timed out after ${elapsedMs}ms (limit ${timeoutMs}ms)`,
      'stream',
      timeoutMs,
      elapsedMs,
    );
    this.name = 'LlmStreamTimeoutError';
  }
}

export class LlmUnavailableError extends LlmError {
  constructor(message: string) {
    super('LLM_UNAVAILABLE', message);
    this.name = 'LlmUnavailableError';
  }
}

export class LlmConfigMissingError extends LlmError {
  constructor(message = 'Missing LLM_API_URL, LLM_API_KEY, or LLM_MODEL') {
    super('LLM_CONFIG_MISSING', message);
    this.name = 'LlmConfigMissingError';
  }
}

export function isLlmFailure(error: unknown): boolean {
  if (error instanceof LlmError) {
    return true;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }

    if (
      error.message.includes('LLM request failed') ||
      error.message.includes('Missing LLM_API') ||
      error.message.includes('LLM response did not include')
    ) {
      return true;
    }
  }

  return false;
}

export function getLlmTimeoutMs(): number {
  const parsed = Number(process.env.LLM_TIMEOUT_MS ?? 15_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15_000;
}

/** Tempo máximo até headers HTTP (TCP/TLS). Separado do TTFT. */
export function getLlmConnectTimeoutMs(): number {
  const parsed = Number(process.env.LLM_CONNECT_TIMEOUT_MS ?? 3_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3_000;
}

/** Tempo máximo até o primeiro token de conteúdo (TTFT), contado desde o início do fetch. */
export function getLlmTtftTimeoutMs(): number {
  const parsed = Number(process.env.LLM_TTFT_TIMEOUT_MS ?? 5_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5_000;
}

export function getLlmTimeoutKind(error: unknown): LlmTimeoutKind | undefined {
  if (error instanceof LlmTimeoutError) {
    return error.timeoutKind;
  }

  if (error instanceof Error) {
    if (error.message.includes('time-to-first-token')) {
      return 'ttft';
    }

    if (error.message.includes('connection timed out')) {
      return 'connection';
    }

    if (error.message.includes('stream timed out') || error.message.includes('stream aborted')) {
      return 'stream';
    }
  }

  return undefined;
}

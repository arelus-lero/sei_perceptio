export type LlmErrorCode = 'LLM_TIMEOUT' | 'LLM_UNAVAILABLE' | 'LLM_CONFIG_MISSING';

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string) {
    super(message);
    this.name = 'LlmError';
    this.code = code;
  }
}

export class LlmTimeoutError extends LlmError {
  constructor(message = 'LLM request timed out') {
    super('LLM_TIMEOUT', message);
    this.name = 'LlmTimeoutError';
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

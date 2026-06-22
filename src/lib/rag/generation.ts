import {
  AI_SEAL_MARKDOWN,
  MAX_HISTORY_TURNS,
  SYSTEM_PROMPT,
} from '@/lib/rag/prompts/system';
import type { AppLogger } from '@/lib/logger';
import type {
  ConversationTurn,
  GenerationParams,
  LlmMessage,
  RetrievedChunk,
} from '@/lib/rag/types';
import {
  getLlmConnectTimeoutMs,
  getLlmTimeoutMs,
  getLlmTtftTimeoutMs,
  LlmConfigMissingError,
  LlmConnectionTimeoutError,
  LlmStreamTimeoutError,
  LlmTtftTimeoutError,
  LlmUnavailableError,
} from '@/lib/rag/llm-errors';

interface LlmConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      /** Ignorado — raciocínio interno Gemini (thought_signature). */
      extra_content?: unknown;
    };
  }>;
}

export interface StreamLlmResponseOptions {
  /** Tempo máximo do stream após headers (não inclui espera por headers). */
  streamTimeoutMs?: number;
  connectTimeoutMs?: number;
  ttftTimeoutMs?: number;
  log?: AppLogger;
  /** Retry interno desabilitado quando true (evita loop). */
  skipRetry?: boolean;
}

interface LlmTimingState {
  t0: number;
  headersReceived: boolean;
  firstContentReceived: boolean;
  connectTimeoutMs: number;
  ttftTimeoutMs: number;
}

function getLlmConfig(): LlmConfig {
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!apiUrl || !apiKey || !model) {
    throw new LlmConfigMissingError();
  }

  return { apiUrl, apiKey, model };
}

function getLlmTemperature(): number {
  const parsed = Number(process.env.LLM_TEMPERATURE ?? 0.3);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
    throw new LlmConfigMissingError('LLM_TEMPERATURE must be between 0 and 2');
  }
  return parsed;
}

function getLlmMaxTokens(): number {
  const parsed = Number(process.env.LLM_MAX_TOKENS ?? 4096);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new LlmConfigMissingError('LLM_MAX_TOKENS must be a positive integer');
  }
  return Math.floor(parsed);
}

/** Incluído no corpo apenas quando LLM_REASONING_EFFORT está definido (ex.: "none" para Gemini). */
function getLlmReasoningEffort(): string | undefined {
  const raw = process.env.LLM_REASONING_EFFORT;
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Fallback Gemini 2.5 via extra_body quando reasoning_effort não é suportado. */
function getLlmThinkingBudget(): number | undefined {
  const raw = process.env.LLM_THINKING_BUDGET;
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new LlmConfigMissingError('LLM_THINKING_BUDGET must be an integer');
  }

  return Math.floor(parsed);
}

export function buildLlmRequestBody(
  model: string,
  messages: LlmMessage[],
  stream = true,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: getLlmTemperature(),
    max_tokens: getLlmMaxTokens(),
    stream,
  };

  const reasoningEffort = getLlmReasoningEffort();
  const thinkingBudget = getLlmThinkingBudget();

  if (reasoningEffort !== undefined && thinkingBudget !== undefined) {
    throw new LlmConfigMissingError(
      'LLM_REASONING_EFFORT and LLM_THINKING_BUDGET are mutually exclusive',
    );
  }

  if (reasoningEffort !== undefined) {
    body.reasoning_effort = reasoningEffort;
  } else if (thinkingBudget !== undefined) {
    body.extra_body = {
      google: {
        thinking_config: {
          thinking_budget: thinkingBudget,
        },
      },
    };
  }

  return body;
}

function summarizeRequestBody(body: Record<string, unknown>): Record<string, unknown> {
  return {
    model: body.model,
    stream: body.stream,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
    reasoning_effort: body.reasoning_effort ?? null,
    has_thinking_config: Boolean(body.extra_body),
    message_count: Array.isArray(body.messages) ? body.messages.length : 0,
  };
}

function elapsedMs(t0: number): number {
  return Math.round(performance.now() - t0);
}

function createAbortGuard(
  timing: LlmTimingState,
  abortController: AbortController,
): { clear: () => void } {
  const connectTimer = setTimeout(() => {
    if (!timing.headersReceived) {
      abortController.abort();
    }
  }, timing.connectTimeoutMs);

  const ttftTimer = setTimeout(() => {
    if (!timing.firstContentReceived) {
      abortController.abort();
    }
  }, timing.ttftTimeoutMs);

  return {
    clear() {
      clearTimeout(connectTimer);
      clearTimeout(ttftTimer);
    },
  };
}

function mapAbortError(timing: LlmTimingState): LlmConnectionTimeoutError | LlmTtftTimeoutError {
  const elapsed = elapsedMs(timing.t0);

  if (!timing.headersReceived) {
    return new LlmConnectionTimeoutError(timing.connectTimeoutMs, elapsed);
  }

  return new LlmTtftTimeoutError(timing.ttftTimeoutMs, elapsed);
}

async function readStreamChunkWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (timeoutMs <= 0) {
    throw new LlmStreamTimeoutError(0, 0);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new LlmStreamTimeoutError(timeoutMs, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function formatChunkContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '<context>\nNenhuma fonte recuperada.\n</context>';
  }

  const formatted = chunks.map((chunk) => {
    const numeroSei = chunk.numero_sei
      ?? String(chunk.metadados_json.numero_sei ?? 'N/A');
    const tipo = chunk.tipo_documento
      ?? String(chunk.metadados_json.tipo_documento ?? 'N/A');
    const unidade = chunk.unidade_geradora
      ?? String(chunk.metadados_json.unidade_geradora ?? 'N/A');

    return `<fonte numero_sei="${numeroSei}" tipo="${tipo}" unidade="${unidade}">\n${chunk.conteudo}\n</fonte>`;
  });

  return `<context>\n${formatted.join('\n')}\n</context>`;
}

export function buildChatMessages(params: GenerationParams): LlmMessage[] {
  const history = params.history.slice(-MAX_HISTORY_TURNS);

  const systemPromptBase = params.systemPromptOverride
    ? `${SYSTEM_PROMPT}\n\n${params.systemPromptOverride}`
    : SYSTEM_PROMPT;

  return [
    {
      role: 'system',
      content: `${systemPromptBase}\n\n${formatChunkContext(params.chunks)}`,
    },
    ...history.map((turn: ConversationTurn) => ({
      role: turn.role,
      content: turn.conteudo,
    })),
    { role: 'user', content: params.userMessage },
  ];
}

function parseSseLines(buffer: string): { tokens: string[]; remainder: string } {
  const tokens: string[] = [];
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) {
      continue;
    }

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') {
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as OpenAiStreamChunk;
      const content = parsed.choices?.[0]?.delta?.content;
      if (typeof content === 'string' && content.length > 0) {
        tokens.push(content);
      }
    } catch {
      continue;
    }
  }

  return { tokens, remainder };
}

async function streamLlmResponseOnce(
  params: GenerationParams,
  options: StreamLlmResponseOptions,
): Promise<ReadableStream<string>> {
  const { apiUrl, apiKey, model } = getLlmConfig();
  const messages = buildChatMessages(params);
  const requestBody = buildLlmRequestBody(model, messages);
  const log = options.log;

  log?.info(
    {
      event: 'llm_request',
      request: summarizeRequestBody(requestBody),
    },
    'LLM request prepared',
  );

  const connectTimeoutMs = options.connectTimeoutMs ?? getLlmConnectTimeoutMs();
  const ttftTimeoutMs = options.ttftTimeoutMs ?? getLlmTtftTimeoutMs();
  const streamTimeoutMs = options.streamTimeoutMs ?? getLlmTimeoutMs();

  const timing: LlmTimingState = {
    t0: performance.now(),
    headersReceived: false,
    firstContentReceived: false,
    connectTimeoutMs,
    ttftTimeoutMs,
  };

  const abortController = new AbortController();
  const abortGuard = createAbortGuard(timing, abortController);

  let response: Response;

  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    });
    timing.headersReceived = true;
    abortGuard.clear();

    log?.info(
      {
        event: 'llm_timing',
        t_connect_ms: elapsedMs(timing.t0),
        timeout_kind: 'none',
      },
      'LLM connected',
    );
  } catch (error) {
    abortGuard.clear();

    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = mapAbortError(timing);
      log?.warn(
        {
          event: 'llm_timing',
          timeout_kind: timeoutError.timeoutKind,
          t_connect_ms: elapsedMs(timing.t0),
          timeout_ms: timeoutError.timeoutMs,
        },
        timeoutError.message,
      );
      throw timeoutError;
    }

    throw new LlmUnavailableError(
      error instanceof Error ? error.message : 'LLM request failed',
    );
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new LlmUnavailableError(`LLM request failed (${response.status}): ${errorBody}`);
  }

  if (!response.body) {
    throw new LlmUnavailableError('LLM response did not include a stream body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sealAppended = false;
  const streamStartedAt = performance.now();

  return new ReadableStream<string>({
    async start(controller) {
      try {
        while (true) {
          const streamElapsedMs = performance.now() - streamStartedAt;
          const remainingStreamMs = streamTimeoutMs - streamElapsedMs;

          if (!timing.firstContentReceived) {
            const remainingTtftMs = ttftTimeoutMs - elapsedMs(timing.t0);
            if (remainingTtftMs <= 0) {
              throw new LlmTtftTimeoutError(ttftTimeoutMs, elapsedMs(timing.t0));
            }

            const { done, value } = await readStreamChunkWithTimeout(
              reader,
              Math.min(remainingTtftMs, remainingStreamMs),
            );

            if (value) {
              buffer += decoder.decode(value, { stream: true });
              const { tokens, remainder } = parseSseLines(buffer);
              buffer = remainder;
              for (const token of tokens) {
                if (!timing.firstContentReceived) {
                  timing.firstContentReceived = true;
                  log?.info(
                    {
                      event: 'llm_timing',
                      t_first_token_ms: elapsedMs(timing.t0),
                      timeout_kind: 'none',
                    },
                    'LLM first token',
                  );
                }
                controller.enqueue(token);
              }
            }

            if (done) {
              if (!sealAppended) {
                controller.enqueue(`\n\n${AI_SEAL_MARKDOWN}`);
                sealAppended = true;
              }
              log?.info(
                {
                  event: 'llm_timing',
                  t_total_ms: elapsedMs(timing.t0),
                  timeout_kind: 'none',
                },
                'LLM stream done',
              );
              controller.close();
              break;
            }

            continue;
          }

          if (remainingStreamMs <= 0) {
            throw new LlmStreamTimeoutError(streamTimeoutMs, Math.round(streamElapsedMs));
          }

          const { done, value } = await readStreamChunkWithTimeout(reader, remainingStreamMs);

          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const { tokens, remainder } = parseSseLines(buffer);
            buffer = remainder;
            for (const token of tokens) {
              controller.enqueue(token);
            }
          }

          if (done) {
            if (!sealAppended) {
              controller.enqueue(`\n\n${AI_SEAL_MARKDOWN}`);
              sealAppended = true;
            }
            log?.info(
              {
                event: 'llm_timing',
                t_total_ms: elapsedMs(timing.t0),
                timeout_kind: 'none',
              },
              'LLM stream done',
            );
            controller.close();
            break;
          }
        }
      } catch (error) {
        if (
          error instanceof LlmConnectionTimeoutError ||
          error instanceof LlmTtftTimeoutError ||
          error instanceof LlmStreamTimeoutError
        ) {
          log?.warn(
            {
              event: 'llm_timing',
              timeout_kind: error.timeoutKind,
              t_elapsed_ms: elapsedMs(timing.t0),
              timeout_ms: error.timeoutMs,
            },
            error.message,
          );
          controller.error(error);
          return;
        }

        if (error instanceof Error && error.name === 'AbortError') {
          const timeoutError = mapAbortError(timing);
          controller.error(timeoutError);
          return;
        }

        controller.error(
          error instanceof Error
            ? new LlmUnavailableError(error.message)
            : new LlmUnavailableError('LLM stream failed'),
        );
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function streamLlmResponse(
  params: GenerationParams,
  options: StreamLlmResponseOptions = {},
): Promise<ReadableStream<string>> {
  try {
    return await streamLlmResponseOnce(params, options);
  } catch (error) {
    const canRetry =
      !options.skipRetry &&
      error instanceof LlmConnectionTimeoutError;

    if (!canRetry) {
      throw error;
    }

    options.log?.info(
      {
        event: 'llm_retry',
        reason: error.timeoutKind,
        backoff_ms: 250,
      },
      'Retrying LLM after connection timeout',
    );

    await sleep(250);

    return streamLlmResponseOnce(params, { ...options, skipRetry: true });
  }
}

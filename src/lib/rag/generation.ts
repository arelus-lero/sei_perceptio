import {
  AI_SEAL_MARKDOWN,
  MAX_HISTORY_TURNS,
  SYSTEM_PROMPT,
} from '@/lib/rag/prompts/system';
import type {
  ConversationTurn,
  GenerationParams,
  LlmMessage,
  RetrievedChunk,
} from '@/lib/rag/types';
import {
  getLlmTimeoutMs,
  LlmConfigMissingError,
  LlmTimeoutError,
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
    };
  }>;
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

export async function streamLlmResponse(
  params: GenerationParams,
  options: { timeoutMs?: number } = {},
): Promise<ReadableStream<string>> {
  const { apiUrl, apiKey, model } = getLlmConfig();
  const messages = buildChatMessages(params);
  const abortController = new AbortController();
  const timeoutMs = options.timeoutMs ?? getLlmTimeoutMs();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  let response: Response;

  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: getLlmTemperature(),
        max_tokens: getLlmMaxTokens(),
        stream: true,
      }),
      signal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmTimeoutError(`LLM request timed out after ${timeoutMs}ms`);
    }

    throw new LlmUnavailableError(
      error instanceof Error ? error.message : 'LLM request failed',
    );
  } finally {
    clearTimeout(timeoutId);
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

  return new ReadableStream<string>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

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
            controller.close();
            break;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          controller.error(new LlmTimeoutError(`LLM stream timed out after ${timeoutMs}ms`));
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

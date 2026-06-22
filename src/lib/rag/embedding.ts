import type { EmbedResponse } from '@/lib/rag/types';

const EMBEDDING_DIMENSIONS = 384;
/** Tamanho de batch por requisição à Edge Function (evita WORKER_RESOURCE_LIMIT). */
const EMBED_REQUEST_BATCH_SIZE = 8;
const MAX_EMBED_RETRIES = 3;
const DEFAULT_EMBED_TIMEOUT_MS = 30_000;

export interface EmbedTextOptions {
  timeoutMs?: number;
  batchSize?: number;
}

function getEmbedConfig(): { url: string; anonKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const embedUrl = process.env.EMBED_FUNCTION_URL
    ?? (supabaseUrl ? `${supabaseUrl}/functions/v1/embed` : undefined);

  if (!embedUrl || !anonKey) {
    throw new Error(
      'Missing EMBED_FUNCTION_URL (or NEXT_PUBLIC_SUPABASE_URL) or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return { url: embedUrl, anonKey };
}

function assertEmbeddingDimensions(embeddings: number[][]): void {
  for (const [index, embedding] of embeddings.entries()) {
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding at index ${index} has ${embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isEmbedResourceLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('546')
    || message.includes('WORKER_RESOURCE_LIMIT')
    || message.includes('Resource limit')
  );
}

async function fetchEmbedBatch(
  texts: string[],
  options: EmbedTextOptions,
): Promise<number[][]> {
  const { url, anonKey } = getEmbedConfig();
  const abortController = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_EMBED_TIMEOUT_MS;
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          abortController.abort();
        }, timeoutMs)
      : undefined;

  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ texts }),
      signal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Embed function timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Embed function failed (${response.status}): ${errorBody}`);
  }

  const payload = (await response.json()) as EmbedResponse;

  if (!Array.isArray(payload.embeddings)) {
    throw new Error('Embed function returned an invalid payload.');
  }

  if (payload.embeddings.length !== texts.length) {
    throw new Error('Embed function returned an unexpected number of vectors.');
  }

  assertEmbeddingDimensions(payload.embeddings);
  return payload.embeddings;
}

async function embedBatchWithRetry(
  texts: string[],
  options: EmbedTextOptions,
): Promise<number[][]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_EMBED_RETRIES; attempt += 1) {
    try {
      return await fetchEmbedBatch(texts, options);
    } catch (error) {
      lastError = error;

      if (!isEmbedResourceLimitError(error) || attempt >= MAX_EMBED_RETRIES - 1) {
        throw error;
      }

      const backoffMs = 500 * 2 ** attempt;
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Embed batch failed');
}

export async function embedTexts(
  texts: string[],
  options: EmbedTextOptions = {},
): Promise<number[][]> {
  const sanitized = texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  if (sanitized.length === 0) {
    return [];
  }

  const batchSize = options.batchSize ?? EMBED_REQUEST_BATCH_SIZE;
  const batches: number[][] = [];

  for (let index = 0; index < sanitized.length; index += batchSize) {
    const slice = sanitized.slice(index, index + batchSize);
    const batchEmbeddings = await embedBatchWithRetry(slice, options);
    batches.push(...batchEmbeddings);
  }

  return batches;
}

export async function embedText(text: string, options: EmbedTextOptions = {}): Promise<number[]> {
  const [embedding] = await embedTexts([text], options);
  if (!embedding) {
    throw new Error('Embed function returned no vector for the input text.');
  }
  return embedding;
}

export function embeddingToPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

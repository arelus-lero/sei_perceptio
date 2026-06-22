import { getEncoding } from 'js-tiktoken';

import { ENCODING, type Chunk } from '@/lib/rag/chunking';
import type { EmbedResponse } from '@/lib/rag/types';

export const EDGE_TOKEN_BUDGET = 2048;
export const EDGE_MAX_ITEMS = 16;
export const EDGE_TIMEOUT_MS = 20_000;
export const MAX_RETRIES = 4;

const RESOURCE_LIMIT_STATUS = 546;
const MAX_SPLIT_DEPTH = 6;
const EMBEDDING_DIMENSIONS = 384;

export type EmbedErrorCode = 'resource_limit' | 'bad_dim' | 'failed';

export class EmbedError extends Error {
  constructor(
    public code: EmbedErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'EmbedError';
  }
}

export interface EmbeddableItem {
  conteudo: string;
  tokens: number;
}

export interface EmbedTextOptions {
  timeoutMs?: number;
}

let encodingCache: ReturnType<typeof getEncoding> | null = null;

function getEmbedEncoding(): ReturnType<typeof getEncoding> {
  if (!encodingCache) {
    encodingCache = getEncoding(ENCODING);
  }
  return encodingCache;
}

function countTextTokens(text: string): number {
  return getEmbedEncoding().encode(text.trim()).length;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function jitteredBackoffMs(attempt: number): number {
  return 2 ** attempt * 250 + Math.floor(Math.random() * 201);
}

function isAbortOrTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError' || error.message.includes('timed out');
  }
  return false;
}

export function isEmbedResourceLimitError(error: unknown): boolean {
  if (error instanceof EmbedError) {
    return error.code === 'resource_limit';
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('546')
    || message.includes('WORKER_RESOURCE_LIMIT')
    || message.includes('Resource limit')
    || isAbortOrTimeoutError(error)
  );
}

interface EmbedErrorBody {
  code?: string;
  message?: string;
}

async function postEmbedRequest(
  texts: string[],
  timeoutMs: number,
): Promise<Response> {
  const { url, anonKey } = getEmbedConfig();
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
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
      throw new EmbedError('failed', `Embed function timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function embedBatchWithRetry(
  texts: string[],
  attempt = 0,
  depth = 0,
  timeoutMs: number = EDGE_TIMEOUT_MS,
): Promise<number[][]> {
  const sanitized = texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  if (sanitized.length === 0) {
    return [];
  }

  try {
    const response = await postEmbedRequest(sanitized, timeoutMs);

    if (response.ok) {
      const payload = (await response.json()) as EmbedResponse;

      if (!Array.isArray(payload.embeddings)) {
        throw new EmbedError('failed', 'Embed function returned an invalid payload.');
      }

      if (payload.embeddings.length !== sanitized.length) {
        throw new EmbedError(
          'failed',
          'Embed function returned an unexpected number of vectors.',
        );
      }

      for (const vector of payload.embeddings) {
        if (vector.length !== EMBEDDING_DIMENSIONS) {
          throw new EmbedError('bad_dim', 'dimensão != 384');
        }
      }

      return payload.embeddings;
    }

    const body = (await response.json().catch(() => ({}))) as EmbedErrorBody;

    if (response.status === 422 || body.code === 'BAD_DIM') {
      throw new EmbedError('bad_dim', 'Edge retornou BAD_DIM');
    }

    const isResourceLimit =
      response.status === RESOURCE_LIMIT_STATUS
      || body.code === 'WORKER_RESOURCE_LIMIT';

    if (isResourceLimit && sanitized.length > 1 && depth < MAX_SPLIT_DEPTH) {
      const mid = Math.ceil(sanitized.length / 2);
      const firstHalf = await embedBatchWithRetry(
        sanitized.slice(0, mid),
        attempt,
        depth + 1,
        timeoutMs,
      );
      const secondHalf = await embedBatchWithRetry(
        sanitized.slice(mid),
        attempt,
        depth + 1,
        timeoutMs,
      );
      return [...firstHalf, ...secondHalf];
    }

    throw new EmbedError(
      isResourceLimit ? 'resource_limit' : 'failed',
      `status ${response.status}`,
    );
  } catch (error) {
    if (error instanceof EmbedError && error.code === 'bad_dim') {
      throw error;
    }

    if (attempt >= MAX_RETRIES) {
      throw error instanceof EmbedError
        ? error
        : new EmbedError('failed', String(error));
    }

    await sleep(jitteredBackoffMs(attempt));
    return embedBatchWithRetry(sanitized, attempt + 1, depth, timeoutMs);
  }
}

function buildBatchesByTokenBudget<T extends EmbeddableItem>(items: T[]): T[][] {
  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentTokenSum = 0;

  for (const item of items) {
    const wouldExceedBudget =
      currentBatch.length > 0
      && currentTokenSum + item.tokens > EDGE_TOKEN_BUDGET;
    const wouldExceedItems = currentBatch.length >= EDGE_MAX_ITEMS;

    if (wouldExceedBudget || wouldExceedItems) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokenSum = 0;
    }

    currentBatch.push(item);
    currentTokenSum += item.tokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export function buildBatches(chunks: Chunk[]): Chunk[][] {
  return buildBatchesByTokenBudget(chunks);
}

export async function embedChunksStreaming(
  chunks: Chunk[],
  onBatch: (batch: Chunk[], embeddings: number[][]) => Promise<void>,
): Promise<void> {
  const batches = buildBatches(chunks);

  for (const batch of batches) {
    const embeddings = await embedBatchWithRetry(batch.map((chunk) => chunk.conteudo));
    await onBatch(batch, embeddings);
  }
}

export async function embedQuery(
  text: string,
  options: EmbedTextOptions = {},
): Promise<number[]> {
  const sanitized = text.trim();
  if (!sanitized) {
    throw new Error('Embed query text cannot be empty.');
  }

  const timeoutMs = options.timeoutMs ?? EDGE_TIMEOUT_MS;
  const [embedding] = await embedBatchWithRetry([sanitized], 0, 0, timeoutMs);

  if (!embedding) {
    throw new Error('Embed function returned no vector for the query.');
  }

  return embedding;
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

  const items: EmbeddableItem[] = sanitized.map((conteudo) => ({
    conteudo,
    tokens: countTextTokens(conteudo),
  }));

  const batches = buildBatchesByTokenBudget(items);
  const timeoutMs = options.timeoutMs ?? EDGE_TIMEOUT_MS;
  const results: number[][] = [];

  for (const batch of batches) {
    const embeddings = await embedBatchWithRetry(
      batch.map((item) => item.conteudo),
      0,
      0,
      timeoutMs,
    );
    results.push(...embeddings);
  }

  return results;
}

/** @deprecated Use embedQuery for chat retrieval paths. */
export async function embedText(
  text: string,
  options: EmbedTextOptions = {},
): Promise<number[]> {
  return embedQuery(text, options);
}

export function embeddingToPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

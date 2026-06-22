import { createHash } from 'node:crypto';

import type { ChatFilters, RetrievedChunk } from '@/lib/rag/types';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_EMBEDDING_ENTRIES = 256;
const MAX_RETRIEVAL_ENTRIES = 128;

const embeddingCache = new Map<string, CacheEntry<number[]>>();
const retrievalCache = new Map<string, CacheEntry<RetrievedChunk[]>>();
const retrievalKeysByNotebook = new Map<string, Set<string>>();

function getEmbeddingCacheTtlMs(): number {
  const parsed = Number(process.env.RAG_EMBEDDING_CACHE_TTL_MS ?? 120_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
}

function getRetrievalCacheTtlMs(): number {
  const parsed = Number(process.env.RAG_RETRIEVAL_CACHE_TTL_MS ?? 60_000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60_000;
}

function hashParts(parts: string[]): string {
  return createHash('sha256').update(parts.join('\0')).digest('hex');
}

export function normalizeRagQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildActiveFontesKey(fonteIds?: string[]): string {
  if (!fonteIds?.length) {
    return '_all_';
  }

  return [...fonteIds].sort().join(',');
}

function stableFiltrosKey(filtros?: ChatFilters): string {
  if (!filtros) {
    return '';
  }

  const sortedEntries = Object.entries(filtros)
    .filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return true;
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, [...value].sort()];
      }
      return [key, value];
    });

  return JSON.stringify(sortedEntries);
}

export function buildEmbeddingCacheKey(query: string): string {
  const model = process.env.EMBED_MODEL ?? 'gte-small';
  return hashParts(['embed', model, normalizeRagQuery(query)]);
}

export function buildRetrievalCacheKey(params: {
  notebookId: string;
  query: string;
  fontesAtivas?: string[];
  filtros?: ChatFilters;
}): string {
  return hashParts([
    'retrieval',
    params.notebookId,
    normalizeRagQuery(params.query),
    buildActiveFontesKey(params.fontesAtivas),
    stableFiltrosKey(params.filtros),
  ]);
}

function readCacheEntry<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function evictOldest<T>(cache: Map<string, CacheEntry<T>>, maxEntries: number): void {
  while (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cache.delete(oldestKey);
  }
}

function trackRetrievalKey(notebookId: string, key: string): void {
  const keys = retrievalKeysByNotebook.get(notebookId) ?? new Set<string>();
  keys.add(key);
  retrievalKeysByNotebook.set(notebookId, keys);
}

function untrackRetrievalKey(notebookId: string, key: string): void {
  const keys = retrievalKeysByNotebook.get(notebookId);
  if (!keys) {
    return;
  }

  keys.delete(key);
  if (keys.size === 0) {
    retrievalKeysByNotebook.delete(notebookId);
  }
}

export function getCachedQueryEmbedding(key: string): number[] | null {
  return readCacheEntry(embeddingCache, key);
}

export function setCachedQueryEmbedding(key: string, embedding: number[]): void {
  evictOldest(embeddingCache, MAX_EMBEDDING_ENTRIES);
  embeddingCache.set(key, {
    value: embedding,
    expiresAt: Date.now() + getEmbeddingCacheTtlMs(),
  });
}

export function getCachedRetrieval(
  notebookId: string,
  key: string,
): RetrievedChunk[] | null {
  const cached = readCacheEntry(retrievalCache, key);
  if (!cached) {
    untrackRetrievalKey(notebookId, key);
    return null;
  }

  return cached;
}

export function setCachedRetrieval(
  notebookId: string,
  key: string,
  chunks: RetrievedChunk[],
): void {
  evictOldest(retrievalCache, MAX_RETRIEVAL_ENTRIES);
  retrievalCache.set(key, {
    value: chunks,
    expiresAt: Date.now() + getRetrievalCacheTtlMs(),
  });
  trackRetrievalKey(notebookId, key);
}

/** Invalida retrieval cache do notebook ao adicionar/remover fontes (RF-019 / RNF-001). */
export function invalidateNotebookRagCache(notebookId: string): void {
  const keys = retrievalKeysByNotebook.get(notebookId);
  if (!keys) {
    return;
  }

  for (const key of keys) {
    retrievalCache.delete(key);
  }

  retrievalKeysByNotebook.delete(notebookId);
}

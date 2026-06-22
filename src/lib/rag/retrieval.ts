import type { SupabaseClient } from '@supabase/supabase-js';

import { parsePgVector } from '@/lib/processo/vector-utils';
import { resolveStageTimeoutMs } from '@/lib/rag/chat-pipeline-timeout';
import { embedText, embeddingToPgVector } from '@/lib/rag/embedding';
import {
  buildEmbeddingCacheKey,
  buildRetrievalCacheKey,
  getCachedQueryEmbedding,
  getCachedRetrieval,
  setCachedQueryEmbedding,
  setCachedRetrieval,
} from '@/lib/rag/query-cache';
import type { RetrievedChunk, RetrievalParams } from '@/lib/rag/types';

const DEFAULT_TOP_K = 10;
const RRF_K = 60;
const CANDIDATE_LIMIT = 20;
const EMBED_STAGE_BUDGET_MS = 5_000;

interface MatchChunksHybridRow {
  chunk_id: string;
  fonte_id: string;
  conteudo: string;
  metadados_json: Record<string, unknown>;
  score_rrf: number;
  embedding: unknown;
}

function parseMetadataField(
  metadados: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = metadados[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function parseRowEmbedding(value: unknown): number[] | undefined {
  const parsed = parsePgVector(value);
  return parsed && parsed.length > 0 ? parsed : undefined;
}

function mapRowToRetrievedChunk(row: MatchChunksHybridRow): RetrievedChunk {
  const metadados = row.metadados_json ?? {};

  return {
    id: row.chunk_id,
    fonte_id: row.fonte_id,
    conteudo: row.conteudo,
    metadados_json: metadados,
    score_rrf: row.score_rrf,
    numero_sei: parseMetadataField(metadados, ['numero_sei']),
    tipo_documento: parseMetadataField(metadados, ['tipo_documento', 'tipo']),
    unidade_geradora: parseMetadataField(metadados, ['unidade_geradora', 'unidade']),
    data: parseMetadataField(metadados, ['data']),
    embedding: parseRowEmbedding(row.embedding),
  };
}

async function resolveQueryEmbedding(
  query: string,
  getRemainingMs?: () => number,
): Promise<number[]> {
  const cacheKey = buildEmbeddingCacheKey(query);
  const cached = getCachedQueryEmbedding(cacheKey);
  if (cached) {
    return cached;
  }

  const timeoutMs = getRemainingMs
    ? resolveStageTimeoutMs(getRemainingMs, EMBED_STAGE_BUDGET_MS)
    : EMBED_STAGE_BUDGET_MS;

  const embedding = await embedText(query, { timeoutMs });
  setCachedQueryEmbedding(cacheKey, embedding);
  return embedding;
}

export async function retrieveChunks(
  supabase: SupabaseClient,
  params: RetrievalParams,
): Promise<RetrievedChunk[]> {
  const cacheKey = buildRetrievalCacheKey({
    notebookId: params.notebookId,
    query: params.query,
    fontesAtivas: params.fontesAtivas,
    filtros: params.filtros,
  });

  const cached = getCachedRetrieval(params.notebookId, cacheKey);
  if (cached) {
    return cached;
  }

  const queryEmbedding = await resolveQueryEmbedding(
    params.query,
    params.getRemainingMs,
  );

  const { data, error } = await supabase.rpc('match_chunks_hybrid', {
    p_query_embedding: embeddingToPgVector(queryEmbedding),
    p_query_text: params.query,
    p_notebook_id: params.notebookId,
    p_fonte_ids: params.fontesAtivas?.length ? params.fontesAtivas : null,
    p_tipo_documento: params.filtros?.tipo_documento?.length
      ? params.filtros.tipo_documento
      : null,
    p_unidade: params.filtros?.unidade?.length ? params.filtros.unidade : null,
    p_data_inicio: params.filtros?.data_inicio ?? null,
    p_data_fim: params.filtros?.data_fim ?? null,
    p_nup: params.filtros?.nup ?? null,
    p_interessado: params.filtros?.interessado ?? null,
    p_tag_ids: params.filtros?.tags?.length ? params.filtros.tags : null,
    p_top_k: params.topK ?? DEFAULT_TOP_K,
    p_rrf_k: RRF_K,
    p_candidate_limit: CANDIDATE_LIMIT,
  });

  if (error) {
    throw new Error(`Hybrid retrieval failed: ${error.message}`);
  }

  const rows = (data ?? []) as MatchChunksHybridRow[];
  const chunks = rows.map(mapRowToRetrievedChunk);
  setCachedRetrieval(params.notebookId, cacheKey, chunks);
  return chunks;
}

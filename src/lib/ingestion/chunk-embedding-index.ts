import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { embedTexts, embeddingToPgVector } from '@/lib/rag/embedding';
import type { SemanticChunk } from '@/lib/rag/types';

export interface EmbedAndPersistChunksResult {
  chunksIndexed: number;
  embeddingAvailable: boolean;
  embeddingError: string | null;
}

export async function embedAndPersistChunks(params: {
  supabase: SupabaseClient;
  fonteId: string;
  orgaoId: string;
  chunks: SemanticChunk[];
}): Promise<EmbedAndPersistChunksResult> {
  if (params.chunks.length === 0) {
    return {
      chunksIndexed: 0,
      embeddingAvailable: true,
      embeddingError: null,
    };
  }

  let embeddings: (number[] | null)[] = params.chunks.map(() => null);
  let embeddingAvailable = false;
  let embeddingError: string | null = null;

  try {
    const vectors = await embedTexts(params.chunks.map((chunk) => chunk.conteudo));
    embeddings = vectors;
    embeddingAvailable = true;
  } catch (error) {
    embeddingError =
      error instanceof Error ? error.message : 'Falha ao gerar embeddings';
  }

  const rows = params.chunks.map((chunk, index) => ({
    fonte_id: params.fonteId,
    conteudo: chunk.conteudo,
    posicao_inicio: chunk.posicao_inicio,
    posicao_fim: chunk.posicao_fim,
    embedding: embeddings[index]
      ? embeddingToPgVector(embeddings[index] as number[])
      : null,
    metadados_json: {
      ...chunk.metadados,
      embedding_available: embeddingAvailable,
    },
    orgao_id: params.orgaoId,
  }));

  const { error: chunkError } = await params.supabase.from('chunk').insert(rows);

  if (chunkError) {
    throw new Error(`Falha ao persistir chunks: ${chunkError.message}`);
  }

  return {
    chunksIndexed: rows.length,
    embeddingAvailable,
    embeddingError,
  };
}

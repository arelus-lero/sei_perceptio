import { embedTexts } from '@/lib/rag/embedding';
import { resolveStageTimeoutMs } from '@/lib/rag/chat-pipeline-timeout';
import type {
  ConfidenceItem,
  ConfidenceLevel,
  RetrievedChunk,
  VerificationParams,
} from '@/lib/rag/types';

const CONFIDENCE_HIGH = 0.85;
const CONFIDENCE_MEDIUM = 0.65;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function classifyConfidence(similarity: number): ConfidenceLevel {
  if (similarity > CONFIDENCE_HIGH) {
    return 'alto';
  }
  if (similarity >= CONFIDENCE_MEDIUM) {
    return 'medio';
  }
  return 'baixo';
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function hasVerifiableSignal(sentence: string): boolean {
  if (/\b\d{5}\.\d{6}\/\d{4}-\d{2}\b/.test(sentence)) {
    return true;
  }
  if (/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/.test(sentence)) {
    return true;
  }
  if (/\b\d+(?:[.,]\d+)?%?\b/.test(sentence)) {
    return true;
  }
  return /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)+\b/.test(
    sentence,
  );
}

export function extractFactualClaims(resposta: string): string[] {
  const sentences = splitSentences(resposta);
  const claims = sentences.filter(hasVerifiableSignal);

  return [...new Set(claims.map((claim) => claim.trim()))].filter(
    (claim) => claim.length >= 12,
  );
}

function findBestMatchingChunk(
  claimEmbedding: number[],
  chunkEmbeddings: Array<{ chunk: RetrievedChunk; embedding: number[] }>,
): { chunkId: string | null; similarity: number } {
  let bestChunkId: string | null = null;
  let bestSimilarity = -1;

  for (const item of chunkEmbeddings) {
    const similarity = cosineSimilarity(claimEmbedding, item.embedding);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestChunkId = item.chunk.id;
    }
  }

  return {
    chunkId: bestSimilarity >= 0 ? bestChunkId : null,
    similarity: Math.max(bestSimilarity, 0),
  };
}

const VERIFICATION_EMBED_BUDGET_MS = 4_000;

export async function verifyResponseClaims(
  params: VerificationParams,
): Promise<ConfidenceItem[]> {
  const claims = extractFactualClaims(params.resposta);
  if (claims.length === 0 || params.chunks.length === 0) {
    return [];
  }

  const embedTimeoutMs = params.getRemainingMs
    ? resolveStageTimeoutMs(params.getRemainingMs, VERIFICATION_EMBED_BUDGET_MS)
    : VERIFICATION_EMBED_BUDGET_MS;
  const embedOptions = { timeoutMs: embedTimeoutMs };

  const claimEmbeddings = await embedTexts(claims, embedOptions);

  const chunkEmbeddings = params.chunks
    .filter((chunk) => chunk.embedding && chunk.embedding.length > 0)
    .map((chunk) => ({ chunk, embedding: chunk.embedding! }));

  if (chunkEmbeddings.length === 0) {
    return [];
  }

  return claims.map((afirmacao, index) => {
    const claimEmbedding = claimEmbeddings[index] ?? [];
    const match = findBestMatchingChunk(claimEmbedding, chunkEmbeddings);

    return {
      afirmacao,
      nivel: classifyConfidence(match.similarity),
      chunk_id_referencia: match.chunkId,
    };
  });
}

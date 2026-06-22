// supabase/functions/embed/index.ts
// Edge Function: embeddings configuráveis (default gte-small, 384d) — Seção 11 / RF-010
// ÚNICA fonte de embeddings do projeto (ingestão e query RAG).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const EMBEDDING_DIMENSIONS = 384;
const MAX_BATCH_SIZE = 64;

const session = new Supabase.ai.Session(Deno.env.get('EMBED_MODEL') ?? 'gte-small');

const embeddingRunOptions = {
  mean_pool: true,
  normalize: true,
} as const;

interface EmbedRequest {
  text?: string;
  texts?: string[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    },
  });
}

function extractTexts(body: EmbedRequest): string[] | null {
  if (typeof body.text === 'string') {
    const trimmed = body.text.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (Array.isArray(body.texts)) {
    return body.texts
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return null;
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value)
    && value.every((item) => typeof item === 'number' && Number.isFinite(item))
  );
}

function assertEmbeddingDimensions(embedding: number[], index: number): void {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding at index ${index} has ${embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
    );
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await session.run(text, embeddingRunOptions);

  if (!isNumberArray(result)) {
    throw new Error('Model did not return a numeric embedding vector.');
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as EmbedRequest;
    const texts = extractTexts(body);

    if (texts === null) {
      return jsonResponse(
        { error: "Request body must include 'text' (string) or 'texts' (string[])." },
        400,
      );
    }

    if (texts.length === 0) {
      return jsonResponse(
        { error: 'At least one non-empty text is required.' },
        400,
      );
    }

    if (texts.length > MAX_BATCH_SIZE) {
      return jsonResponse(
        { error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}.` },
        400,
      );
    }

    const embeddings = await Promise.all(
      texts.map((text) => generateEmbedding(text)),
    );

    embeddings.forEach((embedding, index) => {
      assertEmbeddingDimensions(embedding, index);
    });

    return jsonResponse({ embeddings });
  } catch (error) {
    console.error('embed function error:', error);
    const message = error instanceof Error
      ? error.message
      : 'Internal server error';

    return jsonResponse({ error: message }, 500);
  }
});

import type { ProcessoStatus } from '@/lib/db/schema';
import { buildFluxoTramitacao } from '@/lib/processo/fluxo-tramitacao';
import { fluxoSimilarity } from '@/lib/processo/fluxo-similarity';
import {
  countInteressadosComuns,
  extractInteressadoKeys,
  jaccardSimilarity,
} from '@/lib/processo/interessados';
import {
  cosineSimilarity,
  meanEmbedding,
  parsePgVector,
} from '@/lib/processo/vector-utils';
import type {
  ProcessoSimilarItem,
  SimilaridadeDimensao,
  SimilaridadeProcessualData,
} from '@/types/similaridade';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ProcessoCandidato {
  id: string;
  nup: string;
  status: ProcessoStatus;
  tipo_processo_codigo: string;
  tipo_processo_desc: string;
  interessados: Record<string, unknown>[];
}

interface ChunkEmbeddingRow {
  processo_id: string;
  embedding: unknown;
}

interface ContentSimilarityRow {
  processo_id: string;
  similarity_score: number;
}

const PESOS = {
  tipo: 0.2,
  conteudo: 0.35,
  fluxo: 0.25,
  interessados: 0.2,
} as const;

const MIN_SCORE = 0.2;
const DEFAULT_LIMIT = 20;
const MAX_CANDIDATES = 120;

function clampScore(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function buildMotivos(dimensoes: SimilaridadeDimensao): string[] {
  const motivos: string[] = [];

  if (dimensoes.tipo >= 1) {
    motivos.push('Mesmo tipo processual');
  }
  if (dimensoes.conteudo >= 0.65) {
    motivos.push('Conteúdo documental similar (embeddings)');
  } else if (dimensoes.conteudo >= 0.45) {
    motivos.push('Sobreposição parcial de conteúdo');
  }
  if (dimensoes.fluxo >= 0.5) {
    motivos.push('Fluxo de tramitação semelhante');
  }
  if (dimensoes.interessados >= 0.35) {
    motivos.push('Interessados em comum');
  }

  return motivos;
}

async function loadContentScores(
  supabase: SupabaseClient,
  orgaoId: string,
  processoRefId: string,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    'match_processos_similar_content',
    {
      p_processo_ref_id: processoRefId,
      p_orgao_id: orgaoId,
      p_match_limit: MAX_CANDIDATES,
    },
  );

  if (!rpcError && rpcRows) {
    for (const row of rpcRows as ContentSimilarityRow[]) {
      scores.set(row.processo_id, clampScore(row.similarity_score));
    }
    return scores;
  }

  const { data: embeddingRows, error: embeddingError } = await supabase.rpc(
    'list_processo_chunk_embeddings',
    { p_orgao_id: orgaoId },
  );

  if (embeddingError || !embeddingRows) {
    return scores;
  }

  const byProcesso = new Map<string, number[][]>();

  for (const row of embeddingRows as ChunkEmbeddingRow[]) {
    const vector = parsePgVector(row.embedding);
    if (!vector) {
      continue;
    }

    const list = byProcesso.get(row.processo_id) ?? [];
    list.push(vector);
    byProcesso.set(row.processo_id, list);
  }

  const refMean = meanEmbedding(byProcesso.get(processoRefId) ?? []);
  if (!refMean) {
    return scores;
  }

  for (const [processoId, vectors] of byProcesso.entries()) {
    if (processoId === processoRefId) {
      continue;
    }

    const candidateMean = meanEmbedding(vectors);
    if (!candidateMean) {
      continue;
    }

    scores.set(processoId, clampScore(cosineSimilarity(refMean, candidateMean)));
  }

  return scores;
}

async function loadFluxoOrdemByProcesso(
  supabase: SupabaseClient,
  orgaoId: string,
  processoIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();

  if (processoIds.length === 0) {
    return map;
  }

  const { data: andamentos, error } = await supabase
    .from('andamento')
    .select('processo_id, data_hora, unidade, tipo')
    .eq('orgao_id', orgaoId)
    .in('processo_id', processoIds)
    .order('data_hora', { ascending: true });

  if (error || !andamentos) {
    return map;
  }

  const grouped = new Map<string, typeof andamentos>();

  for (const andamento of andamentos) {
    const list = grouped.get(andamento.processo_id) ?? [];
    list.push(andamento);
    grouped.set(andamento.processo_id, list);
  }

  for (const processoId of processoIds) {
    const rows = grouped.get(processoId) ?? [];
    const fluxo = buildFluxoTramitacao('', processoId, rows);
    map.set(processoId, fluxo.ordem_unidades);
  }

  return map;
}

export async function buscarProcessosSimilares(
  supabase: SupabaseClient,
  orgaoId: string,
  nupReferencia: string,
  limite = DEFAULT_LIMIT,
): Promise<SimilaridadeProcessualData | null> {
  const { data: referencia, error: referenciaError } = await supabase
    .from('processo')
    .select(
      'id, nup, status, tipo_processo_codigo, tipo_processo_desc, interessados, sigiloso',
    )
    .eq('nup', nupReferencia)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (referenciaError) {
    throw new Error(referenciaError.message);
  }

  if (!referencia) {
    return null;
  }

  if (referencia.sigiloso || referencia.tipo_processo_codigo === '100001101') {
    throw new Error('Processo sigiloso não disponível para busca por semelhança');
  }

  const { data: candidatos, error: candidatosError } = await supabase
    .from('processo')
    .select(
      'id, nup, status, tipo_processo_codigo, tipo_processo_desc, interessados',
    )
    .eq('orgao_id', orgaoId)
    .eq('sigiloso', false)
    .neq('tipo_processo_codigo', '100001101')
    .neq('id', referencia.id)
    .limit(MAX_CANDIDATES);

  if (candidatosError) {
    throw new Error(candidatosError.message);
  }

  const referenciaInteressados = extractInteressadoKeys(
    (referencia.interessados ?? []) as Record<string, unknown>[],
  );

  const candidatoRows = (candidatos ?? []) as ProcessoCandidato[];
  const processoIds = [referencia.id, ...candidatoRows.map((item) => item.id)];
  const fluxoPorProcesso = await loadFluxoOrdemByProcesso(
    supabase,
    orgaoId,
    processoIds,
  );
  const referenciaFluxo = fluxoPorProcesso.get(referencia.id) ?? [];

  const contentScores = await loadContentScores(
    supabase,
    orgaoId,
    referencia.id,
  );

  const resultados: ProcessoSimilarItem[] = [];

  for (const candidato of candidatoRows) {
    const dimensoes: SimilaridadeDimensao = {
      tipo:
        candidato.tipo_processo_codigo === referencia.tipo_processo_codigo
          ? 1
          : 0,
      conteudo: contentScores.get(candidato.id) ?? 0,
      fluxo: 0,
      interessados: 0,
    };

    const candidatoInteressados = extractInteressadoKeys(
      candidato.interessados ?? [],
    );
    dimensoes.interessados = jaccardSimilarity(
      referenciaInteressados,
      candidatoInteressados,
    );

    const candidatoFluxo = fluxoPorProcesso.get(candidato.id) ?? [];
    dimensoes.fluxo = fluxoSimilarity(referenciaFluxo, candidatoFluxo);

    const score_total =
      dimensoes.tipo * PESOS.tipo +
      dimensoes.conteudo * PESOS.conteudo +
      dimensoes.fluxo * PESOS.fluxo +
      dimensoes.interessados * PESOS.interessados;

    if (score_total < MIN_SCORE) {
      continue;
    }

    const motivos = buildMotivos(dimensoes);
    const comuns = countInteressadosComuns(
      referenciaInteressados,
      candidatoInteressados,
    );
    if (comuns > 0 && !motivos.includes('Interessados em comum')) {
      motivos.push(`${comuns} interessado(s) em comum`);
    }

    resultados.push({
      processo_id: candidato.id,
      nup: candidato.nup,
      tipo_processo_codigo: candidato.tipo_processo_codigo,
      tipo_processo_desc: candidato.tipo_processo_desc,
      status: candidato.status,
      score_total: Math.round(score_total * 1000) / 1000,
      dimensoes: {
        tipo: Math.round(dimensoes.tipo * 1000) / 1000,
        conteudo: Math.round(dimensoes.conteudo * 1000) / 1000,
        fluxo: Math.round(dimensoes.fluxo * 1000) / 1000,
        interessados: Math.round(dimensoes.interessados * 1000) / 1000,
      },
      motivos,
    });
  }

  resultados.sort((a, b) => b.score_total - a.score_total);

  return {
    nup_referencia: referencia.nup,
    processo_referencia_id: referencia.id,
    pesos: { ...PESOS },
    resultados: resultados.slice(0, limite),
  };
}

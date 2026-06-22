import type { SupabaseClient } from '@supabase/supabase-js';

import { anonymizeText } from '@/lib/ingestion/anonymizer';
import { invalidateNotebookRagCache } from '@/lib/rag/query-cache';
import type { PoliticaRetencaoRegra } from '@/lib/db/schema';
import { writeAuditLog } from '@/lib/governance/audit-log';
import {
  buildRetentionIdempotencyKey,
  computeExpirationDate,
  isConcludedProcessoStatus,
  isExpired,
  isRetentionAlreadyApplied,
  readRetentionMarker,
  type ApplyRetentionRunSummary,
  type PoliticaRetencaoAtiva,
  type RetencaoEntityMarker,
  type RetencaoEntityTipo,
  type RetentionApplyResult,
  type RetentionCandidate,
} from '@/lib/governance/retention-types';

function parseDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.slice(0, 10);
}

async function hasAuditRetentionRecord(
  supabase: SupabaseClient,
  idempotencyKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('id')
    .contains('detalhes_json', { idempotency_key: idempotencyKey })
    .limit(1);

  if (error) {
    throw new Error(`Falha ao verificar idempotência de retenção: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

async function loadActivePolicies(
  supabase: SupabaseClient,
): Promise<PoliticaRetencaoAtiva[]> {
  const { data, error } = await supabase
    .from('politica_retencao')
    .select('id, orgao_id, nome, tipo_entidade, regra, acao, criado_por_id')
    .eq('ativo', true);

  if (error) {
    throw new Error(`Falha ao carregar políticas de retenção: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    orgao_id: row.orgao_id,
    nome: row.nome,
    tipo_entidade: row.tipo_entidade as RetencaoEntityTipo,
    regra: row.regra as PoliticaRetencaoRegra,
    acao: row.acao as PoliticaRetencaoAtiva['acao'],
    criado_por_id: row.criado_por_id,
  }));
}

async function resolveProcessoReferenceDate(
  supabase: SupabaseClient,
  processoId: string,
  regra: PoliticaRetencaoRegra,
): Promise<string | null> {
  const { data: processo, error } = await supabase
    .from('processo')
    .select('status, updated_at, data_inclusao, created_at')
    .eq('id', processoId)
    .single();

  if (error || !processo) {
    return null;
  }

  if (regra.tipo === 'periodo_dias') {
    return parseDateOnly(processo.data_inclusao)
      ?? processo.created_at
      ?? null;
  }

  if (!isConcludedProcessoStatus(processo.status)) {
    return null;
  }

  return processo.updated_at ?? processo.created_at ?? null;
}

async function findFonteCandidates(
  supabase: SupabaseClient,
  politica: PoliticaRetencaoAtiva,
  now: Date,
): Promise<RetentionCandidate[]> {
  const { data, error } = await supabase
    .from('fonte')
    .select(
      `
      id,
      titulo,
      orgao_id,
      data_ingestao,
      metadados_json,
      documento_sei_id,
      documento:documento_sei_id (
        processo_id
      )
    `,
    )
    .eq('orgao_id', politica.orgao_id);

  if (error) {
    throw new Error(`Falha ao buscar fontes para retenção: ${error.message}`);
  }

  const candidates: RetentionCandidate[] = [];

  for (const fonte of data ?? []) {
    const marker = readRetentionMarker(
      fonte.metadados_json as Record<string, unknown>,
    );
    if (isRetentionAlreadyApplied(marker, politica.id)) {
      continue;
    }

    let referenceIso: string | null = null;

    if (politica.regra.tipo === 'periodo_dias') {
      referenceIso = fonte.data_ingestao;
    } else {
      const documento = (Array.isArray(fonte.documento)
        ? fonte.documento[0]
        : fonte.documento) as { processo_id: string } | null | undefined;
      if (documento?.processo_id) {
        referenceIso = await resolveProcessoReferenceDate(
          supabase,
          documento.processo_id,
          politica.regra,
        );
      }
    }

    if (!referenceIso) {
      continue;
    }

    const expiracao = computeExpirationDate(referenceIso, politica.regra);
    if (!isExpired(expiracao, now)) {
      continue;
    }

    candidates.push({
      entidade_tipo: 'fonte',
      entidade_id: fonte.id,
      orgao_id: fonte.orgao_id,
      referencia_em: referenceIso,
      expirado_em: expiracao.toISOString(),
      titulo: fonte.titulo,
    });
  }

  return candidates;
}

async function findProcessoCandidates(
  supabase: SupabaseClient,
  politica: PoliticaRetencaoAtiva,
  now: Date,
): Promise<RetentionCandidate[]> {
  const { data, error } = await supabase
    .from('processo')
    .select('id, nup, orgao_id, status, updated_at, data_inclusao, created_at, classificacao')
    .eq('orgao_id', politica.orgao_id);

  if (error) {
    throw new Error(`Falha ao buscar processos para retenção: ${error.message}`);
  }

  const candidates: RetentionCandidate[] = [];

  for (const processo of data ?? []) {
    const classificacao = (processo.classificacao ?? {}) as Record<string, unknown>;
    const marker = readRetentionMarker(classificacao);
    if (isRetentionAlreadyApplied(marker, politica.id)) {
      continue;
    }

    let referenceIso: string | null = null;

    if (politica.regra.tipo === 'periodo_dias') {
      referenceIso = parseDateOnly(processo.data_inclusao)
        ?? processo.created_at
        ?? null;
    } else if (isConcludedProcessoStatus(processo.status)) {
      referenceIso = processo.updated_at ?? processo.created_at ?? null;
    }

    if (!referenceIso) {
      continue;
    }

    const expiracao = computeExpirationDate(referenceIso, politica.regra);
    if (!isExpired(expiracao, now)) {
      continue;
    }

    candidates.push({
      entidade_tipo: 'processo',
      entidade_id: processo.id,
      orgao_id: processo.orgao_id,
      referencia_em: referenceIso,
      expirado_em: expiracao.toISOString(),
      titulo: processo.nup,
    });
  }

  return candidates;
}

async function findDocumentoCandidates(
  supabase: SupabaseClient,
  politica: PoliticaRetencaoAtiva,
  now: Date,
): Promise<RetentionCandidate[]> {
  const { data, error } = await supabase
    .from('documento')
    .select('id, numero_sei, orgao_id, processo_id, data_inclusao, created_at')
    .eq('orgao_id', politica.orgao_id);

  if (error) {
    throw new Error(`Falha ao buscar documentos para retenção: ${error.message}`);
  }

  const candidates: RetentionCandidate[] = [];

  for (const documento of data ?? []) {
    const idempotencyKey = buildRetentionIdempotencyKey(
      politica.id,
      documento.id,
    );
    if (await hasAuditRetentionRecord(supabase, idempotencyKey)) {
      continue;
    }

    let referenceIso: string | null = null;

    if (politica.regra.tipo === 'periodo_dias') {
      referenceIso = parseDateOnly(documento.data_inclusao)
        ?? documento.created_at
        ?? null;
    } else {
      referenceIso = await resolveProcessoReferenceDate(
        supabase,
        documento.processo_id,
        politica.regra,
      );
    }

    if (!referenceIso) {
      continue;
    }

    const expiracao = computeExpirationDate(referenceIso, politica.regra);
    if (!isExpired(expiracao, now)) {
      continue;
    }

    candidates.push({
      entidade_tipo: 'documento',
      entidade_id: documento.id,
      orgao_id: documento.orgao_id,
      referencia_em: referenceIso,
      expirado_em: expiracao.toISOString(),
      titulo: documento.numero_sei,
    });
  }

  return candidates;
}

async function findNotebookCandidates(
  supabase: SupabaseClient,
  politica: PoliticaRetencaoAtiva,
  now: Date,
): Promise<RetentionCandidate[]> {
  if (politica.regra.tipo !== 'periodo_dias') {
    return [];
  }

  const { data, error } = await supabase
    .from('notebook')
    .select('id, nome, orgao_id, created_at')
    .eq('orgao_id', politica.orgao_id);

  if (error) {
    throw new Error(`Falha ao buscar notebooks para retenção: ${error.message}`);
  }

  const candidates: RetentionCandidate[] = [];

  for (const notebook of data ?? []) {
    const idempotencyKey = buildRetentionIdempotencyKey(
      politica.id,
      notebook.id,
    );
    if (await hasAuditRetentionRecord(supabase, idempotencyKey)) {
      continue;
    }

    const referenceIso = notebook.created_at;
    const expiracao = computeExpirationDate(referenceIso, politica.regra);
    if (!isExpired(expiracao, now)) {
      continue;
    }

    candidates.push({
      entidade_tipo: 'notebook',
      entidade_id: notebook.id,
      orgao_id: notebook.orgao_id,
      referencia_em: referenceIso,
      expirado_em: expiracao.toISOString(),
      titulo: notebook.nome,
    });
  }

  return candidates;
}

async function findCandidatesForPolicy(
  supabase: SupabaseClient,
  politica: PoliticaRetencaoAtiva,
  now: Date,
): Promise<RetentionCandidate[]> {
  switch (politica.tipo_entidade) {
    case 'fonte':
      return findFonteCandidates(supabase, politica, now);
    case 'processo':
      return findProcessoCandidates(supabase, politica, now);
    case 'documento':
      return findDocumentoCandidates(supabase, politica, now);
    case 'notebook':
      return findNotebookCandidates(supabase, politica, now);
    default:
      return [];
  }
}

function buildMarker(
  politica: PoliticaRetencaoAtiva,
  candidate: RetentionCandidate,
  dryRun: boolean,
  status: RetencaoEntityMarker['status'],
): RetencaoEntityMarker {
  return {
    politica_id: politica.id,
    politica_nome: politica.nome,
    acao: politica.acao,
    status,
    expirado_em: candidate.expirado_em,
    marcado_em: new Date().toISOString(),
    dry_run: dryRun,
    idempotency_key: buildRetentionIdempotencyKey(
      politica.id,
      candidate.entidade_id,
    ),
  };
}

async function markFonteDeletePending(
  supabase: SupabaseClient,
  fonteId: string,
  marker: RetencaoEntityMarker,
): Promise<void> {
  const { data: fonte, error: fetchError } = await supabase
    .from('fonte')
    .select('metadados_json')
    .eq('id', fonteId)
    .single();

  if (fetchError || !fonte) {
    throw new Error(`Fonte ${fonteId} não encontrada para marcação de exclusão`);
  }

  const metadados = (fonte.metadados_json ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from('fonte')
    .update({
      metadados_json: {
        ...metadados,
        retencao: marker,
      },
    })
    .eq('id', fonteId);

  if (error) {
    throw new Error(`Falha ao marcar fonte para exclusão: ${error.message}`);
  }
}

async function markProcessoRetentionState(
  supabase: SupabaseClient,
  processoId: string,
  marker: RetencaoEntityMarker,
): Promise<void> {
  const { data: processo, error: fetchError } = await supabase
    .from('processo')
    .select('classificacao')
    .eq('id', processoId)
    .single();

  if (fetchError || !processo) {
    throw new Error(`Processo ${processoId} não encontrado para atualização de retenção`);
  }

  const classificacao = (processo.classificacao ?? {}) as Record<string, unknown>;

  const { error } = await supabase
    .from('processo')
    .update({
      classificacao: {
        ...classificacao,
        retencao: marker,
      },
    })
    .eq('id', processoId);

  if (error) {
    throw new Error(`Falha ao atualizar retenção do processo: ${error.message}`);
  }
}

async function anonymizeFonte(
  supabase: SupabaseClient,
  fonteId: string,
  marker: RetencaoEntityMarker,
): Promise<void> {
  const { data: fonte, error: fetchError } = await supabase
    .from('fonte')
    .select('conteudo_texto, metadados_json, notebook_id')
    .eq('id', fonteId)
    .single();

  if (fetchError || !fonte) {
    throw new Error(`Fonte ${fonteId} não encontrada para anonimização`);
  }

  const textoOriginal = fonte.conteudo_texto ?? '';
  const anonymization = textoOriginal
    ? await anonymizeText({ texto: textoOriginal, mode: 'remove' })
    : null;

  const metadados = (fonte.metadados_json ?? {}) as Record<string, unknown>;

  const { error: fonteError } = await supabase
    .from('fonte')
    .update({
      conteudo_texto: anonymization?.texto_anonimizado ?? '',
      anonimizada: true,
      metadados_json: {
        ...metadados,
        retencao: marker,
        retencao_anonimizacao: anonymization?.stats ?? null,
      },
    })
    .eq('id', fonteId);

  if (fonteError) {
    throw new Error(`Falha ao anonimizar fonte: ${fonteError.message}`);
  }

  const { error: chunkError } = await supabase
    .from('chunk')
    .delete()
    .eq('fonte_id', fonteId);

  if (chunkError) {
    throw new Error(`Falha ao remover chunks da fonte anonimizada: ${chunkError.message}`);
  }

  if (typeof fonte.notebook_id === 'string') {
    invalidateNotebookRagCache(fonte.notebook_id);
  }
}

async function anonymizeDocumento(
  supabase: SupabaseClient,
  documentoId: string,
): Promise<void> {
  const { data: documento, error: fetchError } = await supabase
    .from('documento')
    .select('conteudo_texto')
    .eq('id', documentoId)
    .single();

  if (fetchError || !documento) {
    throw new Error(`Documento ${documentoId} não encontrado para anonimização`);
  }

  const textoOriginal = documento.conteudo_texto ?? '';
  const anonymization = textoOriginal
    ? await anonymizeText({ texto: textoOriginal, mode: 'remove' })
    : null;

  const { error } = await supabase
    .from('documento')
    .update({
      conteudo_texto: anonymization?.texto_anonimizado ?? '',
    })
    .eq('id', documentoId);

  if (error) {
    throw new Error(`Falha ao anonimizar documento: ${error.message}`);
  }
}

async function anonymizeProcesso(
  supabase: SupabaseClient,
  processoId: string,
  marker: RetencaoEntityMarker,
): Promise<void> {
  const { data: documentos, error } = await supabase
    .from('documento')
    .select('id')
    .eq('processo_id', processoId);

  if (error) {
    throw new Error(`Falha ao listar documentos do processo: ${error.message}`);
  }

  for (const documento of documentos ?? []) {
    await anonymizeDocumento(supabase, documento.id);
  }

  await markProcessoRetentionState(supabase, processoId, {
    ...marker,
    status: 'anonimizado',
  });
}

async function applyCandidateAction(
  supabase: SupabaseClient,
  politica: PoliticaRetencaoAtiva,
  candidate: RetentionCandidate,
  dryRun: boolean,
): Promise<RetentionApplyResult> {
  const idempotencyKey = buildRetentionIdempotencyKey(
    politica.id,
    candidate.entidade_id,
  );

  if (await hasAuditRetentionRecord(supabase, idempotencyKey)) {
    return {
      politica_id: politica.id,
      entidade_tipo: candidate.entidade_tipo,
      entidade_id: candidate.entidade_id,
      acao: politica.acao,
      status: politica.acao === 'excluir' ? 'aprovacao_pendente' : 'anonimizado',
      dry_run: dryRun,
      skipped: true,
      skip_reason: 'idempotency_audit_log',
    };
  }

  const status: RetencaoEntityMarker['status'] = dryRun
    ? 'dry_run_simulado'
    : politica.acao === 'excluir'
      ? 'aprovacao_pendente'
      : 'anonimizado';

  const marker = buildMarker(politica, candidate, dryRun, status);

  if (!dryRun) {
    if (politica.acao === 'excluir') {
      if (candidate.entidade_tipo === 'fonte') {
        await markFonteDeletePending(supabase, candidate.entidade_id, marker);
      } else if (candidate.entidade_tipo === 'processo') {
        await markProcessoRetentionState(supabase, candidate.entidade_id, marker);
      }
      // documento/notebook: sem hard-delete — apenas audit_log com aprovacao_pendente
    } else if (politica.acao === 'anonimizar') {
      if (candidate.entidade_tipo === 'fonte') {
        await anonymizeFonte(supabase, candidate.entidade_id, marker);
      } else if (candidate.entidade_tipo === 'documento') {
        await anonymizeDocumento(supabase, candidate.entidade_id);
      } else if (candidate.entidade_tipo === 'processo') {
        await anonymizeProcesso(supabase, candidate.entidade_id, marker);
      }
    }
  }

  await writeAuditLog({
    supabase,
    orgaoId: candidate.orgao_id,
    usuarioId: politica.criado_por_id,
    acao: 'configuracao',
    entidadeTipo: candidate.entidade_tipo,
    entidadeId: candidate.entidade_id,
    detalhes: {
      operacao: dryRun ? 'retencao_dry_run' : 'retencao_aplicada',
      politica_id: politica.id,
      politica_nome: politica.nome,
      acao: politica.acao,
      retencao_status: status,
      idempotency_key: idempotencyKey,
      referencia_em: candidate.referencia_em,
      expirado_em: candidate.expirado_em,
      titulo: candidate.titulo,
      dry_run: dryRun,
      requer_aprovacao_admin: politica.acao === 'excluir',
    },
  });

  return {
    politica_id: politica.id,
    entidade_tipo: candidate.entidade_tipo,
    entidade_id: candidate.entidade_id,
    acao: politica.acao,
    status,
    dry_run: dryRun,
    skipped: false,
  };
}

export async function runApplyRetentionJob(
  supabase: SupabaseClient,
  options: { dryRun: boolean },
): Promise<ApplyRetentionRunSummary> {
  const now = new Date();
  const politicas = await loadActivePolicies(supabase);
  const resultados: RetentionApplyResult[] = [];
  let candidatosEncontrados = 0;

  for (const politica of politicas) {
    const candidates = await findCandidatesForPolicy(supabase, politica, now);
    candidatosEncontrados += candidates.length;

    for (const candidate of candidates) {
      const result = await applyCandidateAction(
        supabase,
        politica,
        candidate,
        options.dryRun,
      );
      resultados.push(result);
    }
  }

  const acoesExecutadas = resultados.filter(
    (item) => !item.skipped && !item.dry_run,
  ).length;
  const acoesSimuladas = resultados.filter(
    (item) => !item.skipped && item.dry_run,
  ).length;
  const acoesIgnoradas = resultados.filter((item) => item.skipped).length;

  return {
    dry_run: options.dryRun,
    politicas_processadas: politicas.length,
    candidatos_encontrados: candidatosEncontrados,
    acoes_executadas: acoesExecutadas,
    acoes_simuladas: acoesSimuladas,
    acoes_ignoradas: acoesIgnoradas,
    resultados,
  };
}

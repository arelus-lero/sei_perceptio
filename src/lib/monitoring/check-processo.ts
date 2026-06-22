import type { SupabaseClient } from '@supabase/supabase-js';

import type { AlertaTipoEvento } from '@/lib/db/schema';
import { detectSnapshotChanges } from '@/lib/monitoring/detect-changes';
import {
  buildProcessoSnapshot,
  parseSnapshotData,
  snapshotsEqual,
} from '@/lib/monitoring/snapshot-data';
import type { CheckProcessoResult, CreatedAlerta } from '@/types/monitoring';

interface CheckProcessoOptions {
  supabase: SupabaseClient;
  processoId: string;
  orgaoId: string;
  /** Se informado, gera alertas apenas para estes monitoramentos. */
  monitoramentoIds?: string[];
}

export async function checkProcessoChanges(
  options: CheckProcessoOptions,
): Promise<CheckProcessoResult> {
  const { supabase, processoId, orgaoId, monitoramentoIds } = options;

  const currentSnapshot = await buildProcessoSnapshot(
    supabase,
    processoId,
    orgaoId,
  );

  if (!currentSnapshot) {
    throw new Error(`Processo ${processoId} não encontrado no órgão ${orgaoId}`);
  }

  const { data: latestSnapshotRow, error: snapshotError } = await supabase
    .from('snapshot_processo')
    .select('id, versao, dados_json')
    .eq('processo_id', processoId)
    .eq('orgao_id', orgaoId)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    throw new Error(snapshotError.message);
  }

  if (!latestSnapshotRow) {
    const { error: insertError } = await supabase.from('snapshot_processo').insert({
      processo_id: processoId,
      dados_json: currentSnapshot,
      versao: 1,
      orgao_id: orgaoId,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return {
      processo_id: processoId,
      snapshot_criado: true,
      versao: 1,
      eventos_detectados: 0,
      alertas_gerados: 0,
      alertas: [],
    };
  }

  const previousSnapshot = parseSnapshotData(
    latestSnapshotRow.dados_json as Record<string, unknown>,
  );

  if (
    !previousSnapshot ||
    snapshotsEqual(previousSnapshot, currentSnapshot)
  ) {
    return {
      processo_id: processoId,
      snapshot_criado: false,
      versao: latestSnapshotRow.versao,
      eventos_detectados: 0,
      alertas_gerados: 0,
      alertas: [],
    };
  }

  const events = detectSnapshotChanges(previousSnapshot, currentSnapshot);
  const nextVersao = latestSnapshotRow.versao + 1;

  const { error: insertSnapshotError } = await supabase
    .from('snapshot_processo')
    .insert({
      processo_id: processoId,
      dados_json: currentSnapshot,
      versao: nextVersao,
      orgao_id: orgaoId,
    });

  if (insertSnapshotError) {
    throw new Error(insertSnapshotError.message);
  }

  if (events.length === 0) {
    return {
      processo_id: processoId,
      snapshot_criado: true,
      versao: nextVersao,
      eventos_detectados: 0,
      alertas_gerados: 0,
      alertas: [],
    };
  }

  let monitoramentosQuery = supabase
    .from('monitoramento')
    .select('id')
    .eq('processo_id', processoId)
    .eq('orgao_id', orgaoId)
    .eq('ativo', true);

  if (monitoramentoIds && monitoramentoIds.length > 0) {
    monitoramentosQuery = monitoramentosQuery.in('id', monitoramentoIds);
  }

  const { data: monitoramentos, error: monitoramentoError } =
    await monitoramentosQuery;

  if (monitoramentoError) {
    throw new Error(monitoramentoError.message);
  }

  const alertRows = (monitoramentos ?? []).flatMap((monitoramento) =>
    events.map((event) => ({
      monitoramento_id: monitoramento.id,
      tipo_evento: event.tipo_evento,
      processo_id: processoId,
      descricao: event.descricao,
      lido: false,
      orgao_id: orgaoId,
    })),
  );

  let insertedAlertas: CreatedAlerta[] = [];

  if (alertRows.length > 0) {
    const { data, error: alertError } = await supabase
      .from('alerta')
      .insert(alertRows)
      .select('id, monitoramento_id, tipo_evento, processo_id, descricao, orgao_id, data_criacao');

    if (alertError) {
      throw new Error(alertError.message);
    }

    insertedAlertas = (data ?? []).map((row) => ({
      id: row.id,
      monitoramento_id: row.monitoramento_id,
      tipo_evento: row.tipo_evento as AlertaTipoEvento,
      processo_id: row.processo_id,
      descricao: row.descricao,
      orgao_id: row.orgao_id,
      data_criacao: row.data_criacao,
    }));
  }

  return {
    processo_id: processoId,
    snapshot_criado: true,
    versao: nextVersao,
    eventos_detectados: events.length,
    alertas_gerados: insertedAlertas.length,
    alertas: insertedAlertas,
  };
}

export async function checkAllMonitoredProcessos(
  supabase: SupabaseClient,
  orgaoId: string,
): Promise<CheckProcessoResult[]> {
  const { data: monitoramentos, error } = await supabase
    .from('monitoramento')
    .select('processo_id')
    .eq('orgao_id', orgaoId)
    .eq('ativo', true);

  if (error) {
    throw new Error(error.message);
  }

  const processoIds = [
    ...new Set((monitoramentos ?? []).map((row) => row.processo_id)),
  ];

  const results: CheckProcessoResult[] = [];

  for (const processoId of processoIds) {
    const result = await checkProcessoChanges({
      supabase,
      processoId,
      orgaoId,
    });
    results.push(result);
  }

  return results;
}

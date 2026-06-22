import type { SupabaseClient } from '@supabase/supabase-js';

import type { ProcessoSnapshotData } from '@/types/monitoring';

export function serializeSnapshot(data: ProcessoSnapshotData): string {
  return JSON.stringify({
    processo: data.processo,
    andamentos: [...data.andamentos].sort((a, b) => a.id.localeCompare(b.id)),
    anexacoes: [...data.anexacoes].sort((a, b) => a.id.localeCompare(b.id)),
    consulta_publica: data.consulta_publica,
  });
}

export function snapshotsEqual(
  left: ProcessoSnapshotData,
  right: ProcessoSnapshotData,
): boolean {
  return serializeSnapshot(left) === serializeSnapshot(right);
}

export async function buildProcessoSnapshot(
  supabase: SupabaseClient,
  processoId: string,
  orgaoId: string,
): Promise<ProcessoSnapshotData | null> {
  const { data: processo, error: processoError } = await supabase
    .from('processo')
    .select('id, nup, status, unidade_atual, unidade_geradora')
    .eq('id', processoId)
    .eq('orgao_id', orgaoId)
    .single();

  if (processoError || !processo) {
    return null;
  }

  const [andamentosResult, anexacoesResult, consultaResult] = await Promise.all([
    supabase
      .from('andamento')
      .select('id, data_hora, unidade, tipo, descricao')
      .eq('processo_id', processoId)
      .eq('orgao_id', orgaoId)
      .order('data_hora', { ascending: true }),
    supabase
      .from('anexacao')
      .select(
        'id, processo_pai_id, processo_filho_id, data_anexacao, data_desanexacao',
      )
      .or(`processo_pai_id.eq.${processoId},processo_filho_id.eq.${processoId}`)
      .eq('orgao_id', orgaoId),
    supabase
      .from('consulta_publica')
      .select('id, data_encerramento_efetiva, status_inferido')
      .eq('processo_id', processoId)
      .eq('orgao_id', orgaoId)
      .maybeSingle(),
  ]);

  if (andamentosResult.error || anexacoesResult.error || consultaResult.error) {
    throw new Error(
      andamentosResult.error?.message ??
        anexacoesResult.error?.message ??
        consultaResult.error?.message ??
        'Failed to load processo snapshot data',
    );
  }

  return {
    processo: {
      id: processo.id,
      nup: processo.nup,
      status: processo.status,
      unidade_atual: processo.unidade_atual,
      unidade_geradora: processo.unidade_geradora,
    },
    andamentos: (andamentosResult.data ?? []).map((row) => ({
      id: row.id,
      data_hora: row.data_hora,
      unidade: row.unidade,
      tipo: row.tipo,
      descricao: row.descricao,
    })),
    anexacoes: (anexacoesResult.data ?? []).map((row) => ({
      id: row.id,
      processo_pai_id: row.processo_pai_id,
      processo_filho_id: row.processo_filho_id,
      data_anexacao: row.data_anexacao,
      data_desanexacao: row.data_desanexacao,
    })),
    consulta_publica: consultaResult.data
      ? {
          id: consultaResult.data.id,
          data_encerramento_efetiva: consultaResult.data.data_encerramento_efetiva,
          status_inferido: consultaResult.data.status_inferido,
        }
      : null,
  };
}

export function parseSnapshotData(
  dadosJson: Record<string, unknown>,
): ProcessoSnapshotData | null {
  const processo = dadosJson.processo;
  if (
    !processo ||
    typeof processo !== 'object' ||
    !('id' in processo) ||
    !('nup' in processo) ||
    !('status' in processo)
  ) {
    return null;
  }

  const processoRecord = processo as ProcessoSnapshotData['processo'];
  const andamentosRaw = Array.isArray(dadosJson.andamentos)
    ? dadosJson.andamentos
    : [];
  const anexacoesRaw = Array.isArray(dadosJson.anexacoes)
    ? dadosJson.anexacoes
    : [];

  const consultaRaw = dadosJson.consulta_publica;

  return {
    processo: processoRecord,
    andamentos: andamentosRaw as ProcessoSnapshotData['andamentos'],
    anexacoes: anexacoesRaw as ProcessoSnapshotData['anexacoes'],
    consulta_publica:
      consultaRaw && typeof consultaRaw === 'object'
        ? (consultaRaw as ProcessoSnapshotData['consulta_publica'])
        : null,
  };
}

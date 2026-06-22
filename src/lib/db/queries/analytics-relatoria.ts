import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  RelatoriaAnalyticsData,
  RelatoriaAnalyticsFilters,
  RelatoriaCountItem,
  RelatoriaRegistro,
} from '@/types/analytics-relatoria';

interface AndamentoRow {
  id: string;
  processo_id: string;
  data_hora: string;
  unidade: string;
  descricao: string;
  relator_id: string | null;
  sessao_distribuicao: string | null;
  resultado_deliberativo: string | null;
  processo:
    | { nup: string; sigiloso: boolean }
    | { nup: string; sigiloso: boolean }[];
}

function normalizeProcesso(
  processo: AndamentoRow['processo'],
): { nup: string; sigiloso: boolean } | null {
  const data = Array.isArray(processo) ? processo[0] : processo;
  if (!data) {
    return null;
  }
  return data;
}

function aggregateCounts(
  registros: RelatoriaRegistro[],
  pickKey: (item: RelatoriaRegistro) => string,
  pickLabel: (item: RelatoriaRegistro) => string,
): RelatoriaCountItem[] {
  const counts = new Map<string, RelatoriaCountItem>();

  for (const registro of registros) {
    const chave = pickKey(registro);
    const existing = counts.get(chave);

    if (existing) {
      existing.total += 1;
      continue;
    }

    counts.set(chave, {
      chave,
      rotulo: pickLabel(registro),
      total: 1,
    });
  }

  return [...counts.values()].sort((a, b) => b.total - a.total);
}

function truncateResultado(value: string, max = 72): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

function matchesFilters(
  registro: RelatoriaRegistro,
  filters: RelatoriaAnalyticsFilters,
): boolean {
  if (filters.relator_id && registro.relator_id !== filters.relator_id) {
    return false;
  }

  if (
    filters.sessao_distribuicao
    && registro.sessao_distribuicao !== filters.sessao_distribuicao
  ) {
    return false;
  }

  if (
    filters.resultado_deliberativo
    && registro.resultado_deliberativo !== filters.resultado_deliberativo
  ) {
    return false;
  }

  if (filters.data_inicio) {
    const registroDate = registro.data_hora.slice(0, 10);
    if (registroDate < filters.data_inicio) {
      return false;
    }
  }

  if (filters.data_fim) {
    const registroDate = registro.data_hora.slice(0, 10);
    if (registroDate > filters.data_fim) {
      return false;
    }
  }

  if (filters.q) {
    const term = filters.q.trim().toLowerCase();
    if (!term) {
      return true;
    }

    const haystack = [
      registro.nup,
      registro.relator_nome,
      registro.sessao_distribuicao,
      registro.resultado_deliberativo,
      registro.descricao,
      registro.unidade,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(term)) {
      return false;
    }
  }

  return true;
}

export async function getRelatoriaAnalytics(
  supabase: SupabaseClient,
  orgaoId: string,
  filters: RelatoriaAnalyticsFilters = {},
): Promise<RelatoriaAnalyticsData> {
  const { data: andamentos, error: andamentosError } = await supabase
    .from('andamento')
    .select(
      `
      id,
      processo_id,
      data_hora,
      unidade,
      descricao,
      relator_id,
      sessao_distribuicao,
      resultado_deliberativo,
      processo!andamento_processo_id_fkey!inner (
        nup,
        sigiloso
      )
    `,
    )
    .eq('orgao_id', orgaoId)
    .eq('tipo', 'distribuicao')
    .order('data_hora', { ascending: false });

  if (andamentosError) {
    throw new Error(andamentosError.message);
  }

  const visibleRows = (andamentos ?? [])
    .map((row) => {
      const typed = row as AndamentoRow;
      const processo = normalizeProcesso(typed.processo);

      if (!processo || processo.sigiloso) {
        return null;
      }

      return typed;
    })
    .filter((row): row is AndamentoRow => row !== null);

  const relatorIds = [
    ...new Set(
      visibleRows
        .map((row) => row.relator_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const relatorNomeById = new Map<string, string>();

  if (relatorIds.length > 0) {
    const { data: perfis, error: perfisError } = await supabase
      .from('perfil')
      .select('user_id, nome_completo')
      .eq('orgao_id', orgaoId)
      .in('user_id', relatorIds);

    if (perfisError) {
      throw new Error(perfisError.message);
    }

    for (const perfil of perfis ?? []) {
      relatorNomeById.set(perfil.user_id, perfil.nome_completo);
    }
  }

  const allRegistros: RelatoriaRegistro[] = visibleRows.map((row) => ({
    id: row.id,
    processo_id: row.processo_id,
    nup: normalizeProcesso(row.processo)?.nup ?? '',
    data_hora: row.data_hora,
    unidade: row.unidade,
    descricao: row.descricao,
    relator_id: row.relator_id,
    relator_nome: row.relator_id ? relatorNomeById.get(row.relator_id) ?? null : null,
    sessao_distribuicao: row.sessao_distribuicao,
    resultado_deliberativo: row.resultado_deliberativo,
  }));

  const registros = allRegistros.filter((registro) => matchesFilters(registro, filters));

  const relatoresMap = new Map<string, string>();
  const sessoesSet = new Set<string>();
  const resultadosSet = new Set<string>();

  for (const registro of allRegistros) {
    if (registro.relator_id && registro.relator_nome) {
      relatoresMap.set(registro.relator_id, registro.relator_nome);
    }

    if (registro.sessao_distribuicao) {
      sessoesSet.add(registro.sessao_distribuicao);
    }

    if (registro.resultado_deliberativo) {
      resultadosSet.add(registro.resultado_deliberativo);
    }
  }

  return {
    total_distribuicoes: registros.length,
    por_relator: aggregateCounts(
      registros,
      (item) => item.relator_id ?? '__sem_relator__',
      (item) => item.relator_nome ?? 'Não informado',
    ),
    por_sessao: aggregateCounts(
      registros,
      (item) => item.sessao_distribuicao ?? '__sem_sessao__',
      (item) => item.sessao_distribuicao ?? 'Sem sessão',
    ),
    por_resultado: aggregateCounts(
      registros,
      (item) => item.resultado_deliberativo ?? '__sem_resultado__',
      (item) =>
        item.resultado_deliberativo
          ? truncateResultado(item.resultado_deliberativo)
          : 'Sem resultado',
    ),
    registros,
    filtros_disponiveis: {
      relatores: [...relatoresMap.entries()]
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      sessoes: [...sessoesSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      resultados: [...resultadosSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    },
  };
}

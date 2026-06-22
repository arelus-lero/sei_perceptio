import { z } from 'zod';

import type { AndamentoTipo, ProcessoStatus } from '@/lib/db/schema';
import type {
  AtividadeRecente,
  DashboardData,
  DashboardProcessoItem,
  DashboardProcessosPage,
  PrazoProximo,
  StatusCount,
  TipoProcessoCount,
  UnidadeCount,
} from '@/types/dashboard';
import type { SupabaseClient } from '@supabase/supabase-js';

const STATUS_ORDER: ProcessoStatus[] = [
  'aberto',
  'em_tramitacao',
  'concluido',
  'arquivado',
];

const StatusCountSchema = z.object({
  status: z.enum(['aberto', 'em_tramitacao', 'concluido', 'arquivado']),
  total: z.number().int().nonnegative(),
});

const UnidadeCountSchema = z.object({
  unidade: z.string(),
  total: z.number().int().nonnegative(),
});

const TipoProcessoCountSchema = z.object({
  codigo: z.string(),
  descricao: z.string(),
  total: z.number().int().nonnegative(),
});

const PrazoProximoSchema = z.object({
  processo_id: z.string().uuid(),
  nup: z.string(),
  data_encerramento: z.string(),
  dias_restantes: z.number().int(),
});

const AtividadeRecenteSchema = z.object({
  id: z.string().uuid(),
  processo_id: z.string().uuid(),
  nup: z.string(),
  data_hora: z.string(),
  tipo: z.string(),
  descricao: z.string(),
  unidade: z.string(),
});

const DashboardStatsSchema = z.object({
  total_processos: z.number().int().nonnegative(),
  tempo_medio_tramitacao_dias: z.number().int().nonnegative(),
  contagem_por_status: z.array(StatusCountSchema),
  processos_por_unidade: z.array(UnidadeCountSchema),
  distribuicao_por_tipo: z.array(TipoProcessoCountSchema),
  proximos_prazos: z.array(PrazoProximoSchema),
  atividade_recente: z.array(AtividadeRecenteSchema),
});

const DashboardProcessoRowSchema = z.object({
  id: z.string().uuid(),
  nup: z.string(),
  status: z.enum(['aberto', 'em_tramitacao', 'concluido', 'arquivado']),
  unidade_atual: z.string(),
  tipo_processo_codigo: z.string(),
  tipo_processo_desc: z.string(),
  data_geracao: z.string(),
  updated_at: z.string(),
  total_count: z.coerce.number().int().nonnegative(),
});

export interface DashboardProcessosQuery {
  limit?: number;
  offset?: number;
  cursorUpdatedAt?: string;
  cursorId?: string;
}

function sortStatusCounts(items: StatusCount[]): StatusCount[] {
  const order = new Map(STATUS_ORDER.map((status, index) => [status, index]));

  return [...items].sort(
    (left, right) => (order.get(left.status) ?? 99) - (order.get(right.status) ?? 99),
  );
}

function mapDashboardStats(payload: z.infer<typeof DashboardStatsSchema>): DashboardData {
  return {
    total_processos: payload.total_processos,
    tempo_medio_tramitacao_dias: payload.tempo_medio_tramitacao_dias,
    contagem_por_status: sortStatusCounts(payload.contagem_por_status),
    processos_por_unidade: payload.processos_por_unidade,
    distribuicao_por_tipo: payload.distribuicao_por_tipo,
    proximos_prazos: payload.proximos_prazos,
    atividade_recente: payload.atividade_recente.map((item) => ({
      ...item,
      tipo: item.tipo as AndamentoTipo,
    })),
  };
}

export async function getDashboardData(
  supabase: SupabaseClient,
  orgaoId: string,
): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('get_dashboard_stats', {
    p_orgao_id: orgaoId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const parsed = DashboardStatsSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Resposta inválida de get_dashboard_stats: ${parsed.error.message}`);
  }

  return mapDashboardStats(parsed.data);
}

export async function getDashboardProcessosPage(
  supabase: SupabaseClient,
  orgaoId: string,
  query: DashboardProcessosQuery = {},
): Promise<DashboardProcessosPage> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
  const offset = Math.max(query.offset ?? 0, 0);
  const useKeyset = Boolean(query.cursorUpdatedAt && query.cursorId);

  const { data, error } = await supabase.rpc('list_processos_dashboard', {
    p_orgao_id: orgaoId,
    p_limit: limit,
    p_offset: useKeyset ? 0 : offset,
    p_cursor_updated_at: useKeyset ? query.cursorUpdatedAt : null,
    p_cursor_id: useKeyset ? query.cursorId : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = z.array(DashboardProcessoRowSchema).parse(data ?? []);
  const total = rows[0]?.total_count ?? 0;
  const items: DashboardProcessoItem[] = rows.map((row) => ({
    id: row.id,
    nup: row.nup,
    status: row.status,
    unidade_atual: row.unidade_atual,
    tipo_processo_codigo: row.tipo_processo_codigo,
    tipo_processo_desc: row.tipo_processo_desc,
    data_geracao: row.data_geracao,
    updated_at: row.updated_at,
  }));

  const last = items.at(-1);

  return {
    items,
    pagination: {
      limit,
      offset: useKeyset ? null : offset,
      total,
      has_more: useKeyset
        ? items.length === limit
        : offset + items.length < total,
      next_cursor:
        last && items.length === limit
          ? { updated_at: last.updated_at, id: last.id }
          : null,
    },
  };
}

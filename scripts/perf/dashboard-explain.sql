-- RNF-004: validação de plano de execução do dashboard
-- Uso: psql "$DATABASE_URL" -v orgao_id="'UUID-DO-ORGAO'" -f scripts/perf/dashboard-explain.sql
--
-- Índices esperados (00004_create_indexes.sql):
--   idx_processo_orgao, idx_processo_status, idx_andamento_data, idx_andamento_processo

\echo '=== get_dashboard_stats ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT public.get_dashboard_stats(:orgao_id::uuid);

\echo ''
\echo '=== list_processos_dashboard (OFFSET, limit 50) ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.list_processos_dashboard(:orgao_id::uuid, 50, 0, NULL, NULL);

\echo ''
\echo '=== list_processos_dashboard (keyset, limit 50) ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM public.list_processos_dashboard(
  :orgao_id::uuid,
  50,
  0,
  TIMESTAMPTZ '2099-01-01 00:00:00+00',
  '00000000-0000-0000-0000-000000000000'::uuid
);

\echo ''
\echo '=== agregação base (orgao + sigiloso) — idx_processo_orgao ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT status, COUNT(*)::int
FROM public.processo p
WHERE p.orgao_id = :orgao_id::uuid
  AND p.sigiloso = false
GROUP BY status;

\echo ''
\echo '=== atividade recente — idx_andamento_data ==='
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT a.id, a.data_hora
FROM public.andamento a
INNER JOIN public.processo pr ON pr.id = a.processo_id
WHERE a.orgao_id = :orgao_id::uuid
  AND pr.sigiloso = false
ORDER BY a.data_hora DESC
LIMIT 12;

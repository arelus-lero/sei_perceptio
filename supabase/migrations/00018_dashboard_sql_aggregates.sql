-- Migration: 00016_dashboard_sql_aggregates.sql
-- RNF-004: agregações no PostgreSQL + listagem paginada (sem carregar todos os processos no Node)

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_orgao_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH base AS (
    SELECT
      p.id,
      p.status,
      p.unidade_atual,
      p.tipo_processo_codigo,
      p.tipo_processo_desc,
      p.data_geracao,
      p.updated_at,
      GREATEST(
        0,
        (
          CASE
            WHEN p.status IN ('concluido', 'arquivado') THEN p.updated_at::date
            ELSE CURRENT_DATE
          END - p.data_geracao
        )
      ) AS dias_tramitacao
    FROM public.processo p
    WHERE p.orgao_id = p_orgao_id
      AND p.sigiloso = false
  ),
  status_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('status', s.status, 'total', s.total)
        ORDER BY s.sort_order
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT
        b.status,
        COUNT(*)::int AS total,
        CASE b.status
          WHEN 'aberto' THEN 1
          WHEN 'em_tramitacao' THEN 2
          WHEN 'concluido' THEN 3
          WHEN 'arquivado' THEN 4
          ELSE 5
        END AS sort_order
      FROM base b
      GROUP BY b.status
    ) s
  ),
  unidade_ranked AS (
    SELECT
      b.unidade_atual AS unidade,
      COUNT(*)::int AS total,
      ROW_NUMBER() OVER (
        ORDER BY COUNT(*) DESC, b.unidade_atual ASC
      ) AS rn
    FROM base b
    GROUP BY b.unidade_atual
  ),
  unidade_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('unidade', u.unidade, 'total', u.total)
        ORDER BY u.total DESC, u.unidade ASC
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT ur.unidade, ur.total
      FROM unidade_ranked ur
      WHERE ur.rn <= 10
      UNION ALL
      SELECT
        'Outros'::text AS unidade,
        SUM(ur.total)::int AS total
      FROM unidade_ranked ur
      WHERE ur.rn > 10
      HAVING SUM(ur.total) > 0
    ) u
  ),
  tipo_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'codigo', t.tipo_processo_codigo,
          'descricao', t.tipo_processo_desc,
          'total', t.total
        )
        ORDER BY t.total DESC, t.tipo_processo_codigo ASC
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT
        b.tipo_processo_codigo,
        b.tipo_processo_desc,
        COUNT(*)::int AS total
      FROM base b
      GROUP BY b.tipo_processo_codigo, b.tipo_processo_desc
    ) t
  ),
  prazos_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'processo_id', x.processo_id,
          'nup', x.nup,
          'data_encerramento', x.data_encerramento,
          'dias_restantes', x.dias_restantes
        )
        ORDER BY x.data_encerramento ASC
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT
        cp.processo_id,
        pr.nup,
        cp.data_encerramento_efetiva AS data_encerramento,
        (cp.data_encerramento_efetiva - CURRENT_DATE)::int AS dias_restantes
      FROM public.consulta_publica cp
      INNER JOIN public.processo pr ON pr.id = cp.processo_id
      WHERE cp.orgao_id = p_orgao_id
        AND cp.status_inferido = 'em_andamento'
        AND cp.data_encerramento_efetiva >= CURRENT_DATE
        AND pr.sigiloso = false
      ORDER BY cp.data_encerramento_efetiva ASC
      LIMIT 10
    ) x
  ),
  atividade_json AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', y.id,
          'processo_id', y.processo_id,
          'nup', y.nup,
          'data_hora', y.data_hora,
          'tipo', y.tipo,
          'descricao', y.descricao,
          'unidade', y.unidade
        )
        ORDER BY y.data_hora DESC
      ),
      '[]'::jsonb
    ) AS data
    FROM (
      SELECT
        a.id,
        a.processo_id,
        pr.nup,
        a.data_hora,
        a.tipo,
        a.descricao,
        a.unidade
      FROM public.andamento a
      INNER JOIN public.processo pr ON pr.id = a.processo_id
      WHERE a.orgao_id = p_orgao_id
        AND pr.sigiloso = false
      ORDER BY a.data_hora DESC
      LIMIT 12
    ) y
  )
  SELECT jsonb_build_object(
    'total_processos', (SELECT COUNT(*)::int FROM base),
    'tempo_medio_tramitacao_dias', COALESCE(
      (SELECT ROUND(AVG(b.dias_tramitacao))::int FROM base b),
      0
    ),
    'contagem_por_status', (SELECT sj.data FROM status_json sj),
    'processos_por_unidade', (SELECT uj.data FROM unidade_json uj),
    'distribuicao_por_tipo', (SELECT tj.data FROM tipo_json tj),
    'proximos_prazos', (SELECT pj.data FROM prazos_json pj),
    'atividade_recente', (SELECT aj.data FROM atividade_json aj)
  );
$$;

CREATE OR REPLACE FUNCTION public.list_processos_dashboard(
  p_orgao_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_cursor_updated_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  nup text,
  status text,
  unidade_atual text,
  tipo_processo_codigo text,
  tipo_processo_desc text,
  data_geracao date,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH scoped AS (
    SELECT
      p.id,
      p.nup,
      p.status,
      p.unidade_atual,
      p.tipo_processo_codigo,
      p.tipo_processo_desc,
      p.data_geracao,
      p.updated_at,
      COUNT(*) OVER () AS total_count
    FROM public.processo p
    WHERE p.orgao_id = p_orgao_id
      AND p.sigiloso = false
      AND (
        p_cursor_updated_at IS NULL
        OR p_cursor_id IS NULL
        OR (p.updated_at, p.id) < (p_cursor_updated_at, p_cursor_id)
      )
    ORDER BY p.updated_at DESC, p.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500)
    OFFSET CASE
      WHEN p_cursor_updated_at IS NULL AND p_cursor_id IS NULL
        THEN GREATEST(COALESCE(p_offset, 0), 0)
      ELSE 0
    END
  )
  SELECT
    s.id,
    s.nup,
    s.status,
    s.unidade_atual,
    s.tipo_processo_codigo,
    s.tipo_processo_desc,
    s.data_geracao,
    s.updated_at,
    s.total_count
  FROM scoped s;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_processos_dashboard(uuid, integer, integer, timestamptz, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_processos_dashboard(uuid, integer, integer, timestamptz, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_dashboard_stats IS
  'RF-025/RNF-004: métricas agregadas do dashboard sem transferir linhas de processo ao app.';

COMMENT ON FUNCTION public.list_processos_dashboard IS
  'RNF-004: listagem paginada (OFFSET ou keyset por updated_at+id) de até 500 processos por página.';

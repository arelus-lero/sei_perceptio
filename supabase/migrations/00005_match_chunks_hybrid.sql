-- Migration: 00005_match_chunks_hybrid.sql
-- Busca híbrida vetorial + BM25 com RRF (k=60). SECURITY INVOKER → RLS por orgao_id.

CREATE OR REPLACE FUNCTION public.match_chunks_hybrid(
  p_query_embedding vector(384),
  p_query_text text,
  p_notebook_id uuid,
  p_fonte_ids uuid[] DEFAULT NULL,
  p_tipo_documento text[] DEFAULT NULL,
  p_unidade text[] DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_nup text DEFAULT NULL,
  p_top_k integer DEFAULT 10,
  p_rrf_k integer DEFAULT 60,
  p_candidate_limit integer DEFAULT 20
)
RETURNS TABLE (
  chunk_id uuid,
  fonte_id uuid,
  conteudo text,
  metadados_json jsonb,
  score_rrf double precision
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  WITH filtered_chunks AS (
    SELECT
      c.id,
      c.fonte_id,
      c.conteudo,
      c.metadados_json,
      c.embedding,
      c.tsv
    FROM public.chunk c
    INNER JOIN public.fonte f ON f.id = c.fonte_id
    WHERE f.notebook_id = p_notebook_id
      AND f.ativa = TRUE
      AND (p_fonte_ids IS NULL OR f.id = ANY(p_fonte_ids))
      AND (
        p_tipo_documento IS NULL
        OR c.metadados_json ->> 'tipo_documento' = ANY(p_tipo_documento)
      )
      AND (
        p_unidade IS NULL
        OR c.metadados_json ->> 'unidade_geradora' = ANY(p_unidade)
        OR c.metadados_json ->> 'unidade' = ANY(p_unidade)
      )
      AND (
        p_data_inicio IS NULL
        OR (c.metadados_json ->> 'data')::date >= p_data_inicio
      )
      AND (
        p_data_fim IS NULL
        OR (c.metadados_json ->> 'data')::date <= p_data_fim
      )
      AND (
        p_nup IS NULL
        OR c.metadados_json ->> 'nup' = p_nup
        OR c.metadados_json ->> 'numero_sei' = p_nup
      )
  ),
  vector_search AS (
    SELECT
      fc.id,
      fc.fonte_id,
      fc.conteudo,
      fc.metadados_json,
      ROW_NUMBER() OVER (
        ORDER BY fc.embedding <=> p_query_embedding
      ) AS rank_v
    FROM filtered_chunks fc
    WHERE fc.embedding IS NOT NULL
    ORDER BY fc.embedding <=> p_query_embedding
    LIMIT p_candidate_limit
  ),
  text_search AS (
    SELECT
      fc.id,
      fc.fonte_id,
      fc.conteudo,
      fc.metadados_json,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(fc.tsv, plainto_tsquery('portuguese', p_query_text)) DESC
      ) AS rank_t
    FROM filtered_chunks fc
    WHERE p_query_text IS NOT NULL
      AND trim(p_query_text) <> ''
      AND fc.tsv @@ plainto_tsquery('portuguese', p_query_text)
    ORDER BY ts_rank_cd(fc.tsv, plainto_tsquery('portuguese', p_query_text)) DESC
    LIMIT p_candidate_limit
  ),
  rrf_scores AS (
    SELECT
      combined.id,
      combined.fonte_id,
      combined.conteudo,
      combined.metadados_json,
      SUM(combined.rrf_component) AS score_rrf
    FROM (
      SELECT
        vs.id,
        vs.fonte_id,
        vs.conteudo,
        vs.metadados_json,
        1.0 / (p_rrf_k + vs.rank_v) AS rrf_component
      FROM vector_search vs
      UNION ALL
      SELECT
        ts.id,
        ts.fonte_id,
        ts.conteudo,
        ts.metadados_json,
        1.0 / (p_rrf_k + ts.rank_t) AS rrf_component
      FROM text_search ts
    ) AS combined
    GROUP BY combined.id, combined.fonte_id, combined.conteudo, combined.metadados_json
  )
  SELECT
    rs.id AS chunk_id,
    rs.fonte_id,
    rs.conteudo,
    rs.metadados_json,
    rs.score_rrf
  FROM rrf_scores rs
  ORDER BY rs.score_rrf DESC
  LIMIT p_top_k;
$$;

REVOKE ALL ON FUNCTION public.match_chunks_hybrid FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.match_chunks_hybrid TO authenticated, service_role;

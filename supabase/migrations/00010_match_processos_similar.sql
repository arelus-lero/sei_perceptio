-- Migration: 00010_match_processos_similar.sql
-- RF-037: busca por semelhança processual (conteúdo via pgvector cosine)

CREATE OR REPLACE FUNCTION list_processo_chunk_embeddings(p_orgao_id UUID)
RETURNS TABLE (
    processo_id UUID,
    embedding vector(384)
)
LANGUAGE sql
STABLE
AS $$
    SELECT d.processo_id, c.embedding
    FROM chunk c
    INNER JOIN fonte f ON f.id = c.fonte_id
    INNER JOIN documento d ON d.id = f.documento_sei_id
    WHERE c.orgao_id = p_orgao_id
      AND d.orgao_id = p_orgao_id
      AND d.processo_id IS NOT NULL
      AND c.embedding IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION match_processos_similar_content(
    p_processo_ref_id UUID,
    p_orgao_id UUID,
    p_match_limit INT DEFAULT 30
)
RETURNS TABLE (
    processo_id UUID,
    similarity_score DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    ref_centroid vector(384);
BEGIN
    SELECT AVG(c.embedding)::vector(384)
    INTO ref_centroid
    FROM chunk c
    INNER JOIN fonte f ON f.id = c.fonte_id
    INNER JOIN documento d ON d.id = f.documento_sei_id
    WHERE d.processo_id = p_processo_ref_id
      AND c.orgao_id = p_orgao_id
      AND c.embedding IS NOT NULL;

    IF ref_centroid IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        d.processo_id,
        (1 - (AVG(c.embedding) <=> ref_centroid))::DOUBLE PRECISION AS similarity_score
    FROM chunk c
    INNER JOIN fonte f ON f.id = c.fonte_id
    INNER JOIN documento d ON d.id = f.documento_sei_id
    WHERE c.orgao_id = p_orgao_id
      AND d.processo_id <> p_processo_ref_id
      AND c.embedding IS NOT NULL
    GROUP BY d.processo_id
    ORDER BY AVG(c.embedding) <=> ref_centroid ASC
    LIMIT GREATEST(p_match_limit, 1);
END;
$$;

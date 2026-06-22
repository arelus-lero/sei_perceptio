-- Migration: 00004_create_indexes.sql
-- SEI-Perceptio — Seção 6.3 (índices vetoriais, full-text e filtros)

-- Índice vetorial HNSW (cosine similarity) para chunks
CREATE INDEX idx_chunk_embedding ON chunk
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Índice de texto completo (BM25 fallback)
ALTER TABLE chunk ADD COLUMN tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('portuguese', conteudo)) STORED;

CREATE INDEX idx_chunk_tsv ON chunk USING GIN (tsv);

-- Índices de busca comuns
CREATE INDEX idx_processo_nup ON processo (nup);
CREATE INDEX idx_processo_status ON processo (status);
CREATE INDEX idx_processo_orgao ON processo (orgao_id);
CREATE INDEX idx_documento_processo ON documento (processo_id);
CREATE INDEX idx_andamento_processo ON andamento (processo_id);
CREATE INDEX idx_andamento_data ON andamento (data_hora);
CREATE INDEX idx_fonte_notebook ON fonte (notebook_id);
CREATE INDEX idx_fonte_orgao ON fonte (orgao_id);
CREATE INDEX idx_chunk_fonte ON chunk (fonte_id);
CREATE INDEX idx_conversa_notebook ON conversa (notebook_id);
CREATE INDEX idx_mensagem_conversa ON mensagem (conversa_id);
CREATE INDEX idx_monitoramento_usuario ON monitoramento (usuario_id);
CREATE INDEX idx_alerta_monitoramento ON alerta (monitoramento_id);
CREATE INDEX idx_alerta_lido ON alerta (lido) WHERE lido = FALSE;
CREATE INDEX idx_audit_log_usuario ON audit_log (usuario_id);
CREATE INDEX idx_audit_log_data ON audit_log (data_criacao);
CREATE INDEX idx_anexacao_pai ON anexacao (processo_pai_id);
CREATE INDEX idx_anexacao_filho ON anexacao (processo_filho_id);

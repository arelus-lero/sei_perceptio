-- Migration: 00008_audit_log_immutable.sql
-- RF-040: audit_log INSERT-only, retenção mínima 5 anos

-- ========================================
-- IMPEDIR UPDATE/DELETE em audit_log (defesa em profundidade)
-- ========================================
CREATE OR REPLACE FUNCTION public.audit_log_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION
        'audit_log é imutável (RF-040): operações UPDATE e DELETE não são permitidas'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_prevent_update ON audit_log;
CREATE TRIGGER audit_log_prevent_update
    BEFORE UPDATE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_log_prevent_mutation();

DROP TRIGGER IF EXISTS audit_log_prevent_delete ON audit_log;
CREATE TRIGGER audit_log_prevent_delete
    BEFORE DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_log_prevent_mutation();

-- Revogar mutações para roles expostos via Data API
REVOKE UPDATE, DELETE ON audit_log FROM authenticated, anon;

COMMENT ON TABLE audit_log IS
    'Log imutável de auditoria (RF-040). Retenção mínima: 5 anos. INSERT-only.';

-- ========================================
-- RLS: reforço INSERT-only (sem políticas UPDATE/DELETE)
-- ========================================
DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON audit_log;
CREATE POLICY "audit_log_insert_authenticated" ON audit_log
    FOR INSERT WITH CHECK (
        orgao_id = public.jwt_orgao_id()
        AND (usuario_id IS NULL OR usuario_id = auth.uid())
    );

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log
    FOR SELECT USING (
        orgao_id = public.jwt_orgao_id()
        AND (
            public.jwt_role() = 'admin'
            OR usuario_id = auth.uid()
        )
    );

-- Índice composto para consultas admin por período (retenção 5 anos)
CREATE INDEX IF NOT EXISTS idx_audit_log_orgao_data
    ON audit_log (orgao_id, data_criacao DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_acao
    ON audit_log (orgao_id, acao);

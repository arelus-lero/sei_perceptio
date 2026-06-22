-- Migration: 00007_monitoring_rls_realtime.sql
-- RF-023, RF-024, RF-008: monitoramento, alerta, snapshot_processo + Realtime

-- ========================================
-- SNAPSHOT_PROCESSO — RLS por orgao_id
-- ========================================
DROP POLICY IF EXISTS "snapshot_processo_select_orgao" ON snapshot_processo;
CREATE POLICY "snapshot_processo_select_orgao" ON snapshot_processo
    FOR SELECT USING (orgao_id = public.jwt_orgao_id());

DROP POLICY IF EXISTS "snapshot_processo_insert_orgao" ON snapshot_processo;
CREATE POLICY "snapshot_processo_insert_orgao" ON snapshot_processo
    FOR INSERT WITH CHECK (
        orgao_id = public.jwt_orgao_id()
        AND public.jwt_role() IN ('admin', 'analista', 'consultor')
    );

-- ========================================
-- MONITORAMENTO — RLS por orgao_id + usuário
-- ========================================
DROP POLICY IF EXISTS "monitoramento_select_self" ON monitoramento;
CREATE POLICY "monitoramento_select_self" ON monitoramento
    FOR SELECT USING (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    );

DROP POLICY IF EXISTS "monitoramento_insert_self" ON monitoramento;
CREATE POLICY "monitoramento_insert_self" ON monitoramento
    FOR INSERT WITH CHECK (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    );

DROP POLICY IF EXISTS "monitoramento_update_self" ON monitoramento;
CREATE POLICY "monitoramento_update_self" ON monitoramento
    FOR UPDATE USING (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    )
    WITH CHECK (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    );

DROP POLICY IF EXISTS "monitoramento_delete_self" ON monitoramento;
CREATE POLICY "monitoramento_delete_self" ON monitoramento
    FOR DELETE USING (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    );

-- ========================================
-- ALERTA — RLS por orgao_id + monitoramento do usuário
-- ========================================
DROP POLICY IF EXISTS "alerta_select_self" ON alerta;
CREATE POLICY "alerta_select_self" ON alerta
    FOR SELECT USING (
        orgao_id = public.jwt_orgao_id()
        AND EXISTS (
            SELECT 1 FROM monitoramento m
            WHERE m.id = alerta.monitoramento_id
            AND m.usuario_id = auth.uid()
            AND m.orgao_id = public.jwt_orgao_id()
        )
    );

DROP POLICY IF EXISTS "alerta_insert_self" ON alerta;
CREATE POLICY "alerta_insert_self" ON alerta
    FOR INSERT WITH CHECK (
        orgao_id = public.jwt_orgao_id()
        AND EXISTS (
            SELECT 1 FROM monitoramento m
            WHERE m.id = alerta.monitoramento_id
            AND m.usuario_id = auth.uid()
            AND m.orgao_id = public.jwt_orgao_id()
        )
    );

DROP POLICY IF EXISTS "alerta_update_self" ON alerta;
CREATE POLICY "alerta_update_self" ON alerta
    FOR UPDATE USING (
        orgao_id = public.jwt_orgao_id()
        AND EXISTS (
            SELECT 1 FROM monitoramento m
            WHERE m.id = alerta.monitoramento_id
            AND m.usuario_id = auth.uid()
            AND m.orgao_id = public.jwt_orgao_id()
        )
    )
    WITH CHECK (
        orgao_id = public.jwt_orgao_id()
        AND EXISTS (
            SELECT 1 FROM monitoramento m
            WHERE m.id = alerta.monitoramento_id
            AND m.usuario_id = auth.uid()
            AND m.orgao_id = public.jwt_orgao_id()
        )
    );

-- Service role bypassa RLS para verificação em lote pós-seed (POST /api/monitoramento/check)

-- ========================================
-- SUPABASE REALTIME — publicação da tabela alerta
-- ========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'alerta'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE alerta;
    END IF;
END $$;

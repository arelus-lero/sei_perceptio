-- Migration: 00015_notificacao_preferencia.sql
-- RF-024: preferências de notificação por usuário (e-mail e webhook)

CREATE TABLE notificacao_preferencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    orgao_id UUID NOT NULL REFERENCES orgao(id) ON DELETE CASCADE,
    email_eventos JSONB NOT NULL DEFAULT '{
        "novo_andamento": false,
        "alteracao_status": false,
        "prazo_proximo": false,
        "anexacao": false,
        "distribuicao": false
    }'::jsonb,
    webhook_url TEXT,
    webhook_secret TEXT,
    webhook_eventos JSONB NOT NULL DEFAULT '{
        "novo_andamento": false,
        "alteracao_status": false,
        "prazo_proximo": false,
        "anexacao": false,
        "distribuicao": false
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, orgao_id)
);

CREATE INDEX idx_notificacao_preferencia_orgao ON notificacao_preferencia (orgao_id);

ALTER TABLE notificacao_preferencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacao_preferencia_select_self" ON notificacao_preferencia
    FOR SELECT USING (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    );

CREATE POLICY "notificacao_preferencia_insert_self" ON notificacao_preferencia
    FOR INSERT WITH CHECK (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    );

CREATE POLICY "notificacao_preferencia_update_self" ON notificacao_preferencia
    FOR UPDATE USING (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    )
    WITH CHECK (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    );

CREATE POLICY "notificacao_preferencia_delete_self" ON notificacao_preferencia
    FOR DELETE USING (
        usuario_id = auth.uid()
        AND orgao_id = public.jwt_orgao_id()
    );

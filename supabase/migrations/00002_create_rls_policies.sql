-- Migration: 00002_create_rls_policies.sql
-- RLS + GRANTs + políticas conforme Seção 7 (docs/requisitos_sei_perceptio_ia.md)

-- =============================================================================
-- HELPERS: orgao_id e role do JWT (app_metadata)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.jwt_orgao_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'orgao_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

-- Notebook acessível por role (admin: órgão; analista: dono/compartilhado; consultor: compartilhado)
CREATE OR REPLACE FUNCTION public.notebook_readable(p_notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM notebook n
    LEFT JOIN compartilhamento c
      ON c.notebook_id = n.id
     AND c.usuario_destino_id = auth.uid()
    WHERE n.id = p_notebook_id
      AND n.orgao_id = public.jwt_orgao_id()
      AND (
        public.jwt_role() = 'admin'
        OR (
          public.jwt_role() = 'analista'
          AND (n.usuario_criador_id = auth.uid() OR c.id IS NOT NULL)
        )
        OR (
          public.jwt_role() = 'consultor'
          AND c.id IS NOT NULL
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.notebook_writable(p_notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM notebook n
    LEFT JOIN compartilhamento c
      ON c.notebook_id = n.id
     AND c.usuario_destino_id = auth.uid()
     AND c.permissao = 'edicao'
    WHERE n.id = p_notebook_id
      AND n.orgao_id = public.jwt_orgao_id()
      AND (
        public.jwt_role() = 'admin'
        OR (
          public.jwt_role() = 'analista'
          AND (
            n.usuario_criador_id = auth.uid()
            OR c.id IS NOT NULL
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.fonte_readable(p_fonte_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM fonte f
    WHERE f.id = p_fonte_id
      AND f.orgao_id = public.jwt_orgao_id()
      AND public.notebook_readable(f.notebook_id)
  );
$$;

-- =============================================================================
-- ENABLE RLS (todas as tabelas — Seção 6)
-- =============================================================================
ALTER TABLE orgao ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE andamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE anexacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulta_publica ENABLE ROW LEVEL SECURITY;
ALTER TABLE prorrogacao_cp ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook ENABLE ROW LEVEL SECURITY;
ALTER TABLE fonte ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversa ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE fonte_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE compartilhamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoramento ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerta ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE politica_retensao ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_job ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- GRANTs para authenticated (obrigatório antes das policies)
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON orgao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON perfil TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON processo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON documento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON andamento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON anexacao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON consulta_publica TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON prorrogacao_cp TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notebook TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fonte TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON chunk TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON conversa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mensagem TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON tag TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON fonte_tag TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON compartilhamento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON monitoramento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON alerta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON snapshot_processo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON politica_retensao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON seed_job TO authenticated;

-- =============================================================================
-- orgao — referência: SELECT para authenticated (órgão do JWT)
-- =============================================================================
CREATE POLICY orgao_select_admin ON orgao
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND id = public.jwt_orgao_id());

CREATE POLICY orgao_select_analista ON orgao
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND id = public.jwt_orgao_id());

CREATE POLICY orgao_select_consultor ON orgao
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND id = public.jwt_orgao_id());

-- =============================================================================
-- perfil — RBAC
-- =============================================================================
CREATE POLICY perfil_select_admin ON perfil
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY perfil_select_analista ON perfil
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY perfil_select_consultor ON perfil
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY perfil_insert_admin ON perfil
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY perfil_update_admin ON perfil
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY perfil_delete_admin ON perfil
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- =============================================================================
-- Padrão SEI (processo, documento, andamento, anexacao, consulta_publica,
-- prorrogacao_cp, snapshot_processo): SELECT membros; INSERT admin+analista;
-- UPDATE/DELETE admin
-- =============================================================================

-- processo
CREATE POLICY processo_select_admin ON processo
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY processo_select_analista ON processo
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY processo_select_consultor ON processo
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY processo_insert_admin ON processo
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY processo_insert_analista ON processo
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY processo_update_admin ON processo
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY processo_delete_admin ON processo
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- documento
CREATE POLICY documento_select_admin ON documento
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY documento_select_analista ON documento
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY documento_select_consultor ON documento
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY documento_insert_admin ON documento
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY documento_insert_analista ON documento
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY documento_update_admin ON documento
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY documento_delete_admin ON documento
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- andamento
CREATE POLICY andamento_select_admin ON andamento
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY andamento_select_analista ON andamento
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY andamento_select_consultor ON andamento
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY andamento_insert_admin ON andamento
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY andamento_insert_analista ON andamento
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY andamento_update_admin ON andamento
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY andamento_delete_admin ON andamento
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- anexacao
CREATE POLICY anexacao_select_admin ON anexacao
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY anexacao_select_analista ON anexacao
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY anexacao_select_consultor ON anexacao
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY anexacao_insert_admin ON anexacao
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY anexacao_insert_analista ON anexacao
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY anexacao_update_admin ON anexacao
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY anexacao_delete_admin ON anexacao
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- consulta_publica
CREATE POLICY consulta_publica_select_admin ON consulta_publica
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY consulta_publica_select_analista ON consulta_publica
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY consulta_publica_select_consultor ON consulta_publica
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY consulta_publica_insert_admin ON consulta_publica
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY consulta_publica_insert_analista ON consulta_publica
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY consulta_publica_update_admin ON consulta_publica
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY consulta_publica_delete_admin ON consulta_publica
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- prorrogacao_cp
CREATE POLICY prorrogacao_cp_select_admin ON prorrogacao_cp
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY prorrogacao_cp_select_analista ON prorrogacao_cp
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY prorrogacao_cp_select_consultor ON prorrogacao_cp
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY prorrogacao_cp_insert_admin ON prorrogacao_cp
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY prorrogacao_cp_insert_analista ON prorrogacao_cp
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY prorrogacao_cp_update_admin ON prorrogacao_cp
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY prorrogacao_cp_delete_admin ON prorrogacao_cp
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- snapshot_processo
CREATE POLICY snapshot_processo_select_admin ON snapshot_processo
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY snapshot_processo_select_analista ON snapshot_processo
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY snapshot_processo_select_consultor ON snapshot_processo
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY snapshot_processo_insert_admin ON snapshot_processo
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY snapshot_processo_insert_analista ON snapshot_processo
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY snapshot_processo_update_admin ON snapshot_processo
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY snapshot_processo_delete_admin ON snapshot_processo
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- =============================================================================
-- notebook — dono, compartilhado ou admin do órgão
-- =============================================================================
CREATE POLICY notebook_select_admin ON notebook
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY notebook_select_analista ON notebook
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND (
      usuario_criador_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM compartilhamento c
        WHERE c.notebook_id = notebook.id
          AND c.usuario_destino_id = auth.uid()
      )
    )
  );

CREATE POLICY notebook_select_consultor ON notebook
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM compartilhamento c
      WHERE c.notebook_id = notebook.id
        AND c.usuario_destino_id = auth.uid()
    )
  );

CREATE POLICY notebook_insert_admin ON notebook
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
  );

CREATE POLICY notebook_insert_analista ON notebook
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_criador_id = auth.uid()
  );

CREATE POLICY notebook_update_admin ON notebook
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY notebook_update_analista ON notebook
  FOR UPDATE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_criador_id = auth.uid()
  )
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_criador_id = auth.uid()
  );

CREATE POLICY notebook_delete_admin ON notebook
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY notebook_delete_analista ON notebook
  FOR DELETE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_criador_id = auth.uid()
  );

-- =============================================================================
-- fonte — via notebook acessível
-- =============================================================================
CREATE POLICY fonte_select_admin ON fonte
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
  );

CREATE POLICY fonte_select_analista ON fonte
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_readable(notebook_id)
  );

CREATE POLICY fonte_select_consultor ON fonte
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_readable(notebook_id)
  );

CREATE POLICY fonte_insert_admin ON fonte
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_writable(notebook_id)
  );

CREATE POLICY fonte_insert_analista ON fonte
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_writable(notebook_id)
  );

CREATE POLICY fonte_update_admin ON fonte
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY fonte_update_analista ON fonte
  FOR UPDATE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_writable(notebook_id)
  )
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_writable(notebook_id)
  );

CREATE POLICY fonte_delete_admin ON fonte
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY fonte_delete_analista ON fonte
  FOR DELETE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_writable(notebook_id)
  );

-- =============================================================================
-- chunk — via fonte → notebook
-- =============================================================================
CREATE POLICY chunk_select_admin ON chunk
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
  );

CREATE POLICY chunk_select_analista ON chunk
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND public.fonte_readable(fonte_id)
  );

CREATE POLICY chunk_select_consultor ON chunk
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND public.fonte_readable(fonte_id)
  );

CREATE POLICY chunk_insert_admin ON chunk
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM fonte f
      WHERE f.id = chunk.fonte_id
        AND public.notebook_writable(f.notebook_id)
    )
  );

CREATE POLICY chunk_insert_analista ON chunk
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM fonte f
      WHERE f.id = chunk.fonte_id
        AND public.notebook_writable(f.notebook_id)
    )
  );

CREATE POLICY chunk_update_admin ON chunk
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY chunk_delete_admin ON chunk
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- =============================================================================
-- conversa — via notebook acessível
-- =============================================================================
CREATE POLICY conversa_select_admin ON conversa
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY conversa_select_analista ON conversa
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_readable(notebook_id)
  );

CREATE POLICY conversa_select_consultor ON conversa
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_readable(notebook_id)
  );

CREATE POLICY conversa_insert_admin ON conversa
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
    AND public.notebook_readable(notebook_id)
  );

CREATE POLICY conversa_insert_analista ON conversa
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
    AND public.notebook_readable(notebook_id)
  );

CREATE POLICY conversa_insert_consultor ON conversa
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
    AND public.notebook_readable(notebook_id)
  );

CREATE POLICY conversa_update_admin ON conversa
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY conversa_delete_admin ON conversa
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- =============================================================================
-- mensagem — via conversa → notebook
-- =============================================================================
CREATE POLICY mensagem_select_admin ON mensagem
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY mensagem_select_analista ON mensagem
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1
      FROM conversa cv
      WHERE cv.id = mensagem.conversa_id
        AND public.notebook_readable(cv.notebook_id)
    )
  );

CREATE POLICY mensagem_select_consultor ON mensagem
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1
      FROM conversa cv
      WHERE cv.id = mensagem.conversa_id
        AND public.notebook_readable(cv.notebook_id)
    )
  );

CREATE POLICY mensagem_insert_admin ON mensagem
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM conversa cv
      WHERE cv.id = mensagem.conversa_id
        AND public.notebook_readable(cv.notebook_id)
    )
  );

CREATE POLICY mensagem_insert_analista ON mensagem
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM conversa cv
      WHERE cv.id = mensagem.conversa_id
        AND (cv.usuario_id = auth.uid() OR public.notebook_readable(cv.notebook_id))
    )
  );

CREATE POLICY mensagem_insert_consultor ON mensagem
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM conversa cv
      WHERE cv.id = mensagem.conversa_id
        AND public.notebook_readable(cv.notebook_id)
    )
  );

CREATE POLICY mensagem_update_admin ON mensagem
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY mensagem_delete_admin ON mensagem
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- =============================================================================
-- tag
-- =============================================================================
CREATE POLICY tag_select_admin ON tag
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY tag_select_analista ON tag
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY tag_select_consultor ON tag
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'consultor' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY tag_insert_admin ON tag
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY tag_insert_analista ON tag
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'analista' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY tag_update_admin ON tag
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY tag_delete_admin ON tag
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- =============================================================================
-- fonte_tag — sem orgao_id; via fonte
-- =============================================================================
CREATE POLICY fonte_tag_select_admin ON fonte_tag
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'admin'
    AND public.fonte_readable(fonte_id)
  );

CREATE POLICY fonte_tag_select_analista ON fonte_tag
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND public.fonte_readable(fonte_id)
  );

CREATE POLICY fonte_tag_select_consultor ON fonte_tag
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND public.fonte_readable(fonte_id)
  );

CREATE POLICY fonte_tag_insert_admin ON fonte_tag
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM fonte f
      WHERE f.id = fonte_tag.fonte_id
        AND public.notebook_writable(f.notebook_id)
    )
  );

CREATE POLICY fonte_tag_insert_analista ON fonte_tag
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND EXISTS (
      SELECT 1 FROM fonte f
      WHERE f.id = fonte_tag.fonte_id
        AND public.notebook_writable(f.notebook_id)
    )
  );

CREATE POLICY fonte_tag_delete_admin ON fonte_tag
  FOR DELETE TO authenticated
  USING (
    public.jwt_role() = 'admin'
    AND public.fonte_readable(fonte_id)
  );

CREATE POLICY fonte_tag_delete_analista ON fonte_tag
  FOR DELETE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND EXISTS (
      SELECT 1 FROM fonte f
      WHERE f.id = fonte_tag.fonte_id
        AND public.notebook_writable(f.notebook_id)
    )
  );

-- =============================================================================
-- compartilhamento
-- =============================================================================
CREATE POLICY compartilhamento_select_admin ON compartilhamento
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY compartilhamento_select_analista ON compartilhamento
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND (
      usuario_destino_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM notebook n
        WHERE n.id = compartilhamento.notebook_id
          AND n.usuario_criador_id = auth.uid()
      )
    )
  );

CREATE POLICY compartilhamento_select_consultor ON compartilhamento
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_destino_id = auth.uid()
  );

CREATE POLICY compartilhamento_insert_admin ON compartilhamento
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY compartilhamento_insert_analista ON compartilhamento
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM notebook n
      WHERE n.id = compartilhamento.notebook_id
        AND n.usuario_criador_id = auth.uid()
    )
  );

CREATE POLICY compartilhamento_update_admin ON compartilhamento
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY compartilhamento_delete_admin ON compartilhamento
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY compartilhamento_delete_analista ON compartilhamento
  FOR DELETE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM notebook n
      WHERE n.id = compartilhamento.notebook_id
        AND n.usuario_criador_id = auth.uid()
    )
  );

-- =============================================================================
-- monitoramento — próprio usuário + orgao_id
-- =============================================================================
CREATE POLICY monitoramento_select_admin ON monitoramento
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
  );

CREATE POLICY monitoramento_select_analista ON monitoramento
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  );

CREATE POLICY monitoramento_select_consultor ON monitoramento
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  );

CREATE POLICY monitoramento_insert_admin ON monitoramento
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  );

CREATE POLICY monitoramento_insert_analista ON monitoramento
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  );

CREATE POLICY monitoramento_update_admin ON monitoramento
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY monitoramento_update_analista ON monitoramento
  FOR UPDATE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  )
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  );

CREATE POLICY monitoramento_delete_admin ON monitoramento
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY monitoramento_delete_analista ON monitoramento
  FOR DELETE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  );

-- =============================================================================
-- alerta — via monitoramento do próprio usuário
-- =============================================================================
CREATE POLICY alerta_select_admin ON alerta
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY alerta_select_analista ON alerta
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM monitoramento m
      WHERE m.id = alerta.monitoramento_id
        AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY alerta_select_consultor ON alerta
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM monitoramento m
      WHERE m.id = alerta.monitoramento_id
        AND m.usuario_id = auth.uid()
    )
  );

CREATE POLICY alerta_insert_admin ON alerta
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY alerta_update_admin ON alerta
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY alerta_update_analista ON alerta
  FOR UPDATE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND EXISTS (
      SELECT 1 FROM monitoramento m
      WHERE m.id = alerta.monitoramento_id
        AND m.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
  );

CREATE POLICY alerta_delete_admin ON alerta
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- =============================================================================
-- audit_log — INSERT-only (sem UPDATE/DELETE); SELECT admin ou próprio
-- =============================================================================
CREATE POLICY audit_log_select_admin ON audit_log
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
  );

CREATE POLICY audit_log_select_analista ON audit_log
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  );

CREATE POLICY audit_log_select_consultor ON audit_log
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND usuario_id = auth.uid()
  );

CREATE POLICY audit_log_insert_admin ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'admin'
    AND orgao_id = public.jwt_orgao_id()
  );

CREATE POLICY audit_log_insert_analista ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND (usuario_id IS NULL OR usuario_id = auth.uid())
  );

CREATE POLICY audit_log_insert_consultor ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND (usuario_id IS NULL OR usuario_id = auth.uid())
  );

-- =============================================================================
-- politica_retensao — admin only
-- =============================================================================
CREATE POLICY politica_retensao_select_admin ON politica_retensao
  FOR SELECT TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY politica_retensao_insert_admin ON politica_retensao
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY politica_retensao_update_admin ON politica_retensao
  FOR UPDATE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id())
  WITH CHECK (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

CREATE POLICY politica_retensao_delete_admin ON politica_retensao
  FOR DELETE TO authenticated
  USING (public.jwt_role() = 'admin' AND orgao_id = public.jwt_orgao_id());

-- =============================================================================
-- seed_job — RLS ativo; sem policies para authenticated (somente service_role)
-- =============================================================================

-- =============================================================================
-- service_role: privilégios para seed/admin (bypass RLS ainda exige GRANT de schema)
-- =============================================================================
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


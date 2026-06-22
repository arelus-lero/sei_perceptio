-- Migration: 00012_notebook_compartilhamento_rls_fix.sql
-- Quebra recursão mútua notebook ↔ compartilhamento (SECURITY DEFINER bypassa RLS interno).

CREATE OR REPLACE FUNCTION public.has_notebook_share(p_notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM compartilhamento c
    WHERE c.notebook_id = p_notebook_id
      AND c.usuario_destino_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_notebook(p_notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM notebook n
    WHERE n.id = p_notebook_id
      AND n.usuario_criador_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.has_notebook_share(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_notebook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_notebook_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_notebook(uuid) TO authenticated;

-- notebook: substitui EXISTS em compartilhamento
DROP POLICY IF EXISTS notebook_select_analista ON notebook;
CREATE POLICY notebook_select_analista ON notebook
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND (
      usuario_criador_id = auth.uid()
      OR public.has_notebook_share(id)
    )
  );

DROP POLICY IF EXISTS notebook_select_consultor ON notebook;
CREATE POLICY notebook_select_consultor ON notebook
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'consultor'
    AND orgao_id = public.jwt_orgao_id()
    AND public.has_notebook_share(id)
  );

-- compartilhamento: substitui EXISTS em notebook
DROP POLICY IF EXISTS compartilhamento_select_analista ON compartilhamento;
CREATE POLICY compartilhamento_select_analista ON compartilhamento
  FOR SELECT TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND (
      usuario_destino_id = auth.uid()
      OR public.owns_notebook(notebook_id)
    )
  );

DROP POLICY IF EXISTS compartilhamento_delete_analista ON compartilhamento;
CREATE POLICY compartilhamento_delete_analista ON compartilhamento
  FOR DELETE TO authenticated
  USING (
    public.jwt_role() = 'analista'
    AND orgao_id = public.jwt_orgao_id()
    AND public.owns_notebook(notebook_id)
  );

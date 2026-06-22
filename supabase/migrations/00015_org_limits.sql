-- Migration: 00014_org_limits.sql
-- RF-034: limites configuráveis por órgão (notebooks e fontes por notebook)

CREATE TABLE public.org_limits (
    orgao_id UUID PRIMARY KEY REFERENCES public.orgao(id) ON DELETE CASCADE,
    max_fontes_notebook INTEGER NOT NULL DEFAULT 300
        CHECK (max_fontes_notebook BETWEEN 1 AND 10000),
    max_notebooks INTEGER NOT NULL DEFAULT 500
        CHECK (max_notebooks BETWEEN 1 AND 100000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_id UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.org_limits IS
  'Limites operacionais por órgão (RF-034). Defaults: 300 fontes/notebook, 500 notebooks.';

INSERT INTO public.org_limits (orgao_id)
SELECT id FROM public.orgao
ON CONFLICT (orgao_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_org_limits_on_orgao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.org_limits (orgao_id)
    VALUES (NEW.id)
    ON CONFLICT (orgao_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_limits_on_orgao
    AFTER INSERT ON public.orgao
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_org_limits_on_orgao();

CREATE OR REPLACE FUNCTION public.get_org_limits(p_orgao_id uuid)
RETURNS TABLE (
    max_fontes_notebook integer,
    max_notebooks integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        COALESCE(ol.max_fontes_notebook, 300),
        COALESCE(ol.max_notebooks, 500)
    FROM public.org_limits ol
    WHERE ol.orgao_id = p_orgao_id
    UNION ALL
    SELECT 300, 500
    WHERE NOT EXISTS (
        SELECT 1 FROM public.org_limits WHERE orgao_id = p_orgao_id
    )
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.check_org_quota(
    p_orgao_id uuid,
    p_notebook_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_fontes integer;
    v_max_notebooks integer;
    v_notebook_count bigint;
    v_fonte_count bigint;
BEGIN
    IF p_orgao_id IS DISTINCT FROM public.jwt_orgao_id() THEN
        RAISE EXCEPTION 'orgao_id não autorizado para quota'
            USING ERRCODE = '42501';
    END IF;

    SELECT gl.max_fontes_notebook, gl.max_notebooks
    INTO v_max_fontes, v_max_notebooks
    FROM public.get_org_limits(p_orgao_id) gl;

    SELECT COUNT(*)::bigint
    INTO v_notebook_count
    FROM public.notebook n
    WHERE n.orgao_id = p_orgao_id;

    v_fonte_count := NULL;
    IF p_notebook_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.notebook nb
            WHERE nb.id = p_notebook_id
              AND nb.orgao_id = p_orgao_id
        ) THEN
            RAISE EXCEPTION 'notebook não pertence ao órgão'
                USING ERRCODE = '22023';
        END IF;

        SELECT COUNT(*)::bigint
        INTO v_fonte_count
        FROM public.fonte f
        WHERE f.notebook_id = p_notebook_id
          AND f.orgao_id = p_orgao_id;
    END IF;

    RETURN jsonb_build_object(
        'notebook_count', v_notebook_count,
        'max_notebooks', v_max_notebooks,
        'fonte_count', COALESCE(v_fonte_count, 0),
        'max_fontes_notebook', v_max_fontes
    );
END;
$$;

ALTER TABLE public.org_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_limits_select_member ON public.org_limits
    FOR SELECT TO authenticated
    USING (orgao_id = public.jwt_orgao_id());

CREATE POLICY org_limits_update_admin ON public.org_limits
    FOR UPDATE TO authenticated
    USING (
        public.jwt_role() = 'admin'
        AND orgao_id = public.jwt_orgao_id()
    )
    WITH CHECK (
        public.jwt_role() = 'admin'
        AND orgao_id = public.jwt_orgao_id()
    );

CREATE POLICY org_limits_insert_admin ON public.org_limits
    FOR INSERT TO authenticated
    WITH CHECK (
        public.jwt_role() = 'admin'
        AND orgao_id = public.jwt_orgao_id()
    );

GRANT SELECT, INSERT, UPDATE ON public.org_limits TO authenticated;
GRANT ALL ON public.org_limits TO service_role;
GRANT EXECUTE ON FUNCTION public.get_org_limits(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_org_quota(uuid, uuid) TO authenticated, service_role;

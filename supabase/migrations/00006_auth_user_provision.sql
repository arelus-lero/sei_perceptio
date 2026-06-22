-- Migration: 00006_auth_user_provision.sql
-- Provisiona perfil + app_metadata (orgao_id, role) sem expor claims ao client.
-- Compatível com GoTrue v2.x: INSERT inicial sem app_metadata, UPDATE em seguida.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orgao_id UUID;
  v_role TEXT;
  v_nome TEXT;
  v_meta_sync jsonb;
BEGIN
  v_orgao_id := NULLIF(NEW.raw_app_meta_data ->> 'orgao_id', '')::UUID;
  v_role := NULLIF(NEW.raw_app_meta_data ->> 'role', '');
  v_nome := COALESCE(
    NULLIF(NEW.raw_app_meta_data ->> 'nome_completo', ''),
    NEW.email
  );

  -- GoTrue insere auth.users antes de gravar app_metadata (UPDATE subsequente reativa o trigger).
  IF v_orgao_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'analista', 'consultor') THEN
    v_role := 'consultor';
  END IF;

  INSERT INTO public.perfil (user_id, orgao_id, role, nome_completo)
  VALUES (NEW.id, v_orgao_id, v_role, v_nome)
  ON CONFLICT (user_id) DO UPDATE SET
    orgao_id = EXCLUDED.orgao_id,
    role = EXCLUDED.role,
    nome_completo = EXCLUDED.nome_completo,
    updated_at = NOW();

  v_meta_sync := jsonb_build_object(
    'orgao_id', v_orgao_id::text,
    'role', v_role
  );

  -- Evita loop: este trigger também escuta UPDATE de raw_app_meta_data.
  IF pg_trigger_depth() = 1
     AND (
       NEW.raw_app_meta_data ->> 'orgao_id' IS DISTINCT FROM v_orgao_id::text
       OR NEW.raw_app_meta_data ->> 'role' IS DISTINCT FROM v_role
     )
  THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || v_meta_sync
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF raw_app_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.sync_perfil_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta_sync jsonb;
BEGIN
  v_meta_sync := jsonb_build_object(
    'orgao_id', NEW.orgao_id::text,
    'role', NEW.role
  );

  IF pg_trigger_depth() = 1
     AND (
       SELECT
         raw_app_meta_data ->> 'orgao_id' IS DISTINCT FROM NEW.orgao_id::text
         OR raw_app_meta_data ->> 'role' IS DISTINCT FROM NEW.role
       FROM auth.users
       WHERE id = NEW.user_id
     )
  THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || v_meta_sync
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_perfil_app_metadata() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_perfil_app_metadata() TO postgres, service_role;

DROP TRIGGER IF EXISTS on_perfil_changed ON public.perfil;
CREATE TRIGGER on_perfil_changed
  AFTER INSERT OR UPDATE OF orgao_id, role ON public.perfil
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_perfil_app_metadata();

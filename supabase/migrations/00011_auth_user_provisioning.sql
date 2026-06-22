-- Migration: 00011_auth_user_provisioning.sql
-- RF-041 complemento: sync perfil → auth.users (sem revalidar BEFORE INSERT — incompatível com GoTrue v2.x)

DROP TRIGGER IF EXISTS enforce_auth_user_app_metadata ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_auth_user_app_metadata();

-- ========================================
-- SINCRONIZAR auth.users quando perfil muda (admin API ou SQL)
-- ========================================
CREATE OR REPLACE FUNCTION public.sync_auth_user_app_metadata_from_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta_sync jsonb;
BEGIN
  v_meta_sync := jsonb_build_object(
    'orgao_id', NEW.orgao_id::text,
    'role', NEW.role,
    'nome_completo', NEW.nome_completo
  );

  IF pg_trigger_depth() = 1
     AND (
       SELECT
         raw_app_meta_data ->> 'orgao_id' IS DISTINCT FROM NEW.orgao_id::text
         OR raw_app_meta_data ->> 'role' IS DISTINCT FROM NEW.role
         OR raw_app_meta_data ->> 'nome_completo' IS DISTINCT FROM NEW.nome_completo
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

DROP TRIGGER IF EXISTS perfil_sync_auth_metadata ON public.perfil;
CREATE TRIGGER perfil_sync_auth_metadata
    AFTER INSERT OR UPDATE OF orgao_id, role, nome_completo ON public.perfil
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_auth_user_app_metadata_from_perfil();

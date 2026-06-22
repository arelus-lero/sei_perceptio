-- Migration: 00016_onboarding_perfil.sql
-- RNF-019: onboarding guiado — persistência no perfil

ALTER TABLE perfil
    ADD COLUMN IF NOT EXISTS onboarding_concluido BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.complete_user_onboarding()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE perfil
    SET onboarding_concluido = true,
        updated_at = NOW()
    WHERE user_id = auth.uid()
      AND orgao_id = public.jwt_orgao_id();
END;
$$;

REVOKE ALL ON FUNCTION public.complete_user_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_user_onboarding() TO authenticated;

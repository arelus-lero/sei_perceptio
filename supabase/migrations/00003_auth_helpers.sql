-- Migration: 00003_auth_helpers.sql
-- Helper JWT no schema public (auth schema é gerenciado pelo Supabase)

CREATE OR REPLACE FUNCTION public.jwt_orgao_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata' ->> 'orgao_id',
    ''
  )::uuid
$$;

GRANT EXECUTE ON FUNCTION public.jwt_orgao_id() TO authenticated;

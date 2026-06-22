-- Migration: 99999_grants_service_role.sql
-- Reaplica GRANTs após todas as migrations (tabelas/funções criadas depois da 00002).
-- service_role: seed e jobs admin (bypass RLS). authenticated: schema apenas (RLS + GRANTs da 00002).

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

GRANT USAGE ON SCHEMA public TO authenticated;

-- Migration: 00013_storage_buckets_and_policies.sql
-- Buckets documentos/exportacoes + RLS em storage.objects (path: {orgao_id}/...)

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('documentos', 'documentos', false),
  ('exportacoes', 'exportacoes', false)
ON CONFLICT (id) DO NOTHING;

-- documentos — authenticated, isolamento por orgao_id no 1º segmento do path
DROP POLICY IF EXISTS storage_documentos_select_orgao ON storage.objects;
CREATE POLICY storage_documentos_select_orgao ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  );

DROP POLICY IF EXISTS storage_documentos_insert_orgao ON storage.objects;
CREATE POLICY storage_documentos_insert_orgao ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  );

DROP POLICY IF EXISTS storage_documentos_update_orgao ON storage.objects;
CREATE POLICY storage_documentos_update_orgao ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  )
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  );

DROP POLICY IF EXISTS storage_documentos_delete_orgao ON storage.objects;
CREATE POLICY storage_documentos_delete_orgao ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  );

-- exportacoes — mesmo padrão de path por órgão
DROP POLICY IF EXISTS storage_exportacoes_select_orgao ON storage.objects;
CREATE POLICY storage_exportacoes_select_orgao ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exportacoes'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  );

DROP POLICY IF EXISTS storage_exportacoes_insert_orgao ON storage.objects;
CREATE POLICY storage_exportacoes_insert_orgao ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exportacoes'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  );

DROP POLICY IF EXISTS storage_exportacoes_update_orgao ON storage.objects;
CREATE POLICY storage_exportacoes_update_orgao ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'exportacoes'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  )
  WITH CHECK (
    bucket_id = 'exportacoes'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  );

DROP POLICY IF EXISTS storage_exportacoes_delete_orgao ON storage.objects;
CREATE POLICY storage_exportacoes_delete_orgao ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'exportacoes'
    AND (storage.foldername(name))[1] = public.jwt_orgao_id()::text
  );

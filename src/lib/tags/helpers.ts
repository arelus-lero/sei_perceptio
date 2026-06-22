import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/db/schema';
import { assertNotebookAccess } from '@/lib/notebook/access';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function isValidTagColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value);
}

export function normalizeTagColor(value: string | undefined): string {
  if (value && isValidTagColor(value)) {
    return value;
  }
  return '#6366f1';
}

interface FonteAccessParams {
  supabase: SupabaseClient;
  fonteId: string;
  orgaoId: string;
  userId: string;
  userRole: UserRole;
  require: 'read' | 'edit';
}

export async function assertFonteAccess(
  params: FonteAccessParams,
): Promise<{ fonteId: string; notebookId: string } | null> {
  const { data: fonte, error } = await params.supabase
    .from('fonte')
    .select('id, notebook_id, orgao_id')
    .eq('id', params.fonteId)
    .single();

  if (error || !fonte || fonte.orgao_id !== params.orgaoId) {
    return null;
  }

  const access = await assertNotebookAccess({
    supabase: params.supabase,
    notebookId: fonte.notebook_id,
    orgaoId: params.orgaoId,
    userId: params.userId,
    userRole: params.userRole,
    require: params.require,
  });

  if (!access) {
    return null;
  }

  return {
    fonteId: fonte.id,
    notebookId: fonte.notebook_id,
  };
}

export function mapTagRow(row: {
  id: string;
  nome: string;
  cor: string;
  created_at: string;
}) {
  return {
    id: row.id,
    nome: row.nome,
    cor: row.cor,
    created_at: row.created_at,
  };
}

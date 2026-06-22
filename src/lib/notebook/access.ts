import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserRole, CompartilhamentoPermissao } from '@/lib/db/schema';
import { canExportNotebooks, canShareNotebooks, isAdmin } from '@/lib/auth/rbac';
import type { NotebookAccessSource } from '@/types/notebook-share';

export interface NotebookAccess {
  notebookId: string;
  orgaoId: string;
  ownerId: string;
  source: NotebookAccessSource | null;
  isOwner: boolean;
  canRead: boolean;
  canComment: boolean;
  canEdit: boolean;
  canShare: boolean;
  canExport: boolean;
}

interface ResolveNotebookAccessParams {
  supabase: SupabaseClient;
  notebookId: string;
  orgaoId: string;
  userId: string;
  userRole: UserRole;
}

function permissionsFromShare(
  source: NotebookAccessSource,
  userRole: UserRole,
  isOwner: boolean,
): Omit<NotebookAccess, 'notebookId' | 'orgaoId' | 'ownerId' | 'source' | 'isOwner'> {
  if (isOwner) {
    return {
      canRead: true,
      canComment: true,
      canEdit: canShareNotebooks(userRole),
      canShare: canShareNotebooks(userRole) || isAdmin(userRole),
      canExport: canExportNotebooks(userRole),
    };
  }

  const canRead = source === 'leitura' || source === 'comentario' || source === 'edicao';
  const canComment = source === 'comentario' || source === 'edicao';
  const canEdit = source === 'edicao' && canShareNotebooks(userRole);

  return {
    canRead,
    canComment,
    canEdit,
    canShare: false,
    canExport: source === 'edicao' && canExportNotebooks(userRole),
  };
}

export async function resolveNotebookAccess(
  params: ResolveNotebookAccessParams,
): Promise<NotebookAccess | null> {
  const { data: notebook, error } = await params.supabase
    .from('notebook')
    .select('id, orgao_id, usuario_criador_id')
    .eq('id', params.notebookId)
    .eq('orgao_id', params.orgaoId)
    .maybeSingle();

  if (error || !notebook) {
    return null;
  }

  const isOwner = notebook.usuario_criador_id === params.userId;

  if (isOwner) {
    const perms = permissionsFromShare('owner', params.userRole, true);
    return {
      notebookId: notebook.id,
      orgaoId: notebook.orgao_id,
      ownerId: notebook.usuario_criador_id,
      source: 'owner',
      isOwner: true,
      ...perms,
    };
  }

  const { data: share } = await params.supabase
    .from('compartilhamento')
    .select('permissao')
    .eq('notebook_id', params.notebookId)
    .eq('usuario_destino_id', params.userId)
    .eq('orgao_id', params.orgaoId)
    .maybeSingle();

  if (!share) {
    if (isAdmin(params.userRole)) {
      return {
        notebookId: notebook.id,
        orgaoId: notebook.orgao_id,
        ownerId: notebook.usuario_criador_id,
        source: null,
        isOwner: false,
        canRead: true,
        canComment: true,
        canEdit: true,
        canShare: true,
        canExport: canExportNotebooks(params.userRole),
      };
    }
    return null;
  }

  const permissao = share.permissao as CompartilhamentoPermissao;
  const perms = permissionsFromShare(permissao, params.userRole, false);

  return {
    notebookId: notebook.id,
    orgaoId: notebook.orgao_id,
    ownerId: notebook.usuario_criador_id,
    source: permissao,
    isOwner: false,
    ...perms,
  };
}

export async function assertNotebookAccess(
  params: ResolveNotebookAccessParams & {
    require: 'read' | 'comment' | 'edit' | 'share' | 'export';
  },
): Promise<NotebookAccess | null> {
  const access = await resolveNotebookAccess(params);
  if (!access) {
    return null;
  }

  const allowed =
    (params.require === 'read' && access.canRead)
    || (params.require === 'comment' && access.canComment)
    || (params.require === 'edit' && access.canEdit)
    || (params.require === 'share' && access.canShare)
    || (params.require === 'export' && access.canExport);

  return allowed ? access : null;
}

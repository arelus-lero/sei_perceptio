import { NextRequest, NextResponse } from 'next/server';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { logAuditSafe } from '@/lib/governance/audit-log';
import { assertNotebookAccess } from '@/lib/notebook/access';

interface RouteContext {
  params: Promise<{ id: string; shareId: string }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id: notebookId, shareId } = await context.params;

  const access = await assertNotebookAccess({
    supabase: auth.supabase,
    notebookId,
    orgaoId: auth.orgaoId,
    userId: auth.user.id,
    userRole: auth.role,
    require: 'share',
  });

  if (!access) {
    return forbiddenResponse('Somente o criador ou administrador pode revogar compartilhamentos');
  }

  const { data: existing, error: existingError } = await auth.supabase
    .from('compartilhamento')
    .select('id, usuario_destino_id, permissao')
    .eq('id', shareId)
    .eq('notebook_id', notebookId)
    .eq('orgao_id', auth.orgaoId)
    .maybeSingle();

  if (existingError) {
    console.error('DELETE share fetch error:', existingError);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: 'Compartilhamento não encontrado' }, { status: 404 });
  }

  const { error } = await auth.supabase
    .from('compartilhamento')
    .delete()
    .eq('id', shareId)
    .eq('notebook_id', notebookId)
    .eq('orgao_id', auth.orgaoId);

  if (error) {
    console.error('DELETE /api/notebooks/[id]/share/[shareId] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  await logAuditSafe({
    supabase: auth.supabase,
    orgaoId: auth.orgaoId,
    usuarioId: auth.user.id,
    acao: 'compartilhamento',
    entidadeTipo: 'notebook',
    entidadeId: notebookId,
    detalhes: {
      operacao: 'revogar',
      compartilhamento_id: shareId,
      usuario_destino_id: existing.usuario_destino_id,
      permissao: existing.permissao,
    },
    request,
  });

  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { canWriteNotebooks } from '@/lib/auth/rbac';
import { logAuditSafe } from '@/lib/governance/audit-log';
import { assertNotebookAccess, resolveNotebookAccess } from '@/lib/notebook/access';

const UpdateNotebookSchema = z.object({
  nome: z.string().min(1).max(200).optional(),
  descricao: z.string().max(2000).nullable().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;

  const access = await resolveNotebookAccess({
    supabase: auth.supabase,
    notebookId: id,
    orgaoId: auth.orgaoId,
    userId: auth.user.id,
    userRole: auth.role,
  });

  if (!access?.canRead) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }

  const { data: notebook, error } = await auth.supabase
    .from('notebook')
    .select('id, nome, descricao, orgao_id, usuario_criador_id, created_at, updated_at')
    .eq('id', id)
    .eq('orgao_id', auth.orgaoId)
    .single();

  if (error || !notebook) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }

  const { data: fontes, error: fontesError } = await auth.supabase
    .from('fonte')
    .select('id, titulo, ativa, tipo_origem, metadados_json, created_at')
    .eq('notebook_id', id)
    .order('created_at', { ascending: true });

  if (fontesError) {
    console.error('GET /api/notebooks/[id] fontes error:', fontesError);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  return NextResponse.json(
    {
      notebook: {
        id: notebook.id,
        nome: notebook.nome,
        descricao: notebook.descricao,
        orgao_id: notebook.orgao_id,
        usuario_criador_id: notebook.usuario_criador_id,
        created_at: notebook.created_at,
        updated_at: notebook.updated_at,
        compartilhado: !access.isOwner,
        permissao: access.source,
        can_read: access.canRead,
        can_comment: access.canComment,
        can_edit: access.canEdit,
        can_share: access.canShare,
        can_export: access.canExport,
      },
      fontes: fontes ?? [],
    },
    { status: 200 },
  );
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canWriteNotebooks(auth.role)) {
      return forbiddenResponse('Consultores não podem editar notebooks');
    }

    const { id } = await context.params;

    const access = await assertNotebookAccess({
      supabase: auth.supabase,
      notebookId: id,
      orgaoId: auth.orgaoId,
      userId: auth.user.id,
      userRole: auth.role,
      require: 'edit',
    });

    if (!access?.canEdit) {
      return forbiddenResponse('Sem permissão de edição neste notebook');
    }

    const body = await request.json();
    const validated = UpdateNotebookSchema.parse(body);

    if (validated.nome === undefined && validated.descricao === undefined) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await auth.supabase
      .from('notebook')
      .select('id, usuario_criador_id')
      .eq('id', id)
      .eq('orgao_id', auth.orgaoId)
      .single();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    const updates: Record<string, string | null> = {};
    if (validated.nome !== undefined) {
      updates.nome = validated.nome;
    }
    if (validated.descricao !== undefined) {
      updates.descricao = validated.descricao;
    }

    const { data: notebook, error } = await auth.supabase
      .from('notebook')
      .update(updates)
      .eq('id', id)
      .select('id, nome, descricao, created_at, updated_at')
      .single();

    if (error || !notebook) {
      console.error('PATCH /api/notebooks/[id] error:', error);
      return NextResponse.json({ error: 'Failed to update notebook' }, { status: 500 });
    }

    await logAuditSafe({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      usuarioId: auth.user.id,
      acao: 'modificacao',
      entidadeTipo: 'notebook',
      entidadeId: id,
      detalhes: {
        operacao: 'atualizacao',
        campos: updates,
      },
      request,
    });

    return NextResponse.json({ notebook }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('PATCH /api/notebooks/[id] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  if (!canWriteNotebooks(auth.role)) {
    return forbiddenResponse('Consultores não podem excluir notebooks');
  }

  const { id } = await context.params;

  const access = await resolveNotebookAccess({
    supabase: auth.supabase,
    notebookId: id,
    orgaoId: auth.orgaoId,
    userId: auth.user.id,
    userRole: auth.role,
  });

  if (!access?.canEdit && auth.role !== 'admin') {
    return forbiddenResponse('Sem permissão para excluir este notebook');
  }

  const { data: existing, error: existingError } = await auth.supabase
    .from('notebook')
    .select('id, usuario_criador_id')
    .eq('id', id)
    .eq('orgao_id', auth.orgaoId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }

  if (existing.usuario_criador_id !== auth.user.id && auth.role !== 'admin') {
    return forbiddenResponse('Somente o criador ou admin pode excluir este notebook');
  }

  const { error } = await auth.supabase.from('notebook').delete().eq('id', id);

  if (error) {
    console.error('DELETE /api/notebooks/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete notebook' }, { status: 500 });
  }

  await logAuditSafe({
    supabase: auth.supabase,
    orgaoId: auth.orgaoId,
    usuarioId: auth.user.id,
    acao: 'modificacao',
    entidadeTipo: 'notebook',
    entidadeId: id,
    detalhes: { operacao: 'exclusao' },
    request,
  });

  return new NextResponse(null, { status: 204 });
}

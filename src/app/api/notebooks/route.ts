import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { canWriteNotebooks } from '@/lib/auth/rbac';
import { logAuditSafe } from '@/lib/governance/audit-log';
import {
  assertCanCreateNotebook,
  OrgLimitExceededError,
  orgLimitExceededResponse,
} from '@/lib/governance/org-limits';
import type { NotebookListItem } from '@/types/notebook';

const CreateNotebookSchema = z.object({
  nome: z.string().min(1).max(200),
  descricao: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { supabase, user } = auth;

  const { data: notebooks, error } = await supabase
    .from('notebook')
    .select('id, nome, descricao, created_at, usuario_criador_id')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('GET /api/notebooks error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  const notebookRows = notebooks ?? [];
  const notebookIds = notebookRows.map((row) => row.id);

  const fonteCountByNotebook = new Map<string, number>();

  if (notebookIds.length > 0) {
    const { data: fonteRows, error: fonteError } = await supabase
      .from('fonte')
      .select('notebook_id')
      .in('notebook_id', notebookIds);

    if (fonteError) {
      console.error('GET /api/notebooks fonte count error:', fonteError);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    for (const row of fonteRows ?? []) {
      fonteCountByNotebook.set(
        row.notebook_id,
        (fonteCountByNotebook.get(row.notebook_id) ?? 0) + 1,
      );
    }
  }

  const responseNotebooks: NotebookListItem[] = notebookRows.map((row) => ({
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    fontes_count: fonteCountByNotebook.get(row.id) ?? 0,
    data_criacao: row.created_at,
    compartilhado: row.usuario_criador_id !== user.id,
  }));

  return NextResponse.json({ notebooks: responseNotebooks }, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    if (!canWriteNotebooks(auth.role)) {
      return forbiddenResponse('Consultores não podem criar notebooks');
    }

    const body = await request.json();
    const validated = CreateNotebookSchema.parse(body);

    await assertCanCreateNotebook(auth.supabase, auth.orgaoId);

    const { data: notebook, error } = await auth.supabase
      .from('notebook')
      .insert({
        nome: validated.nome,
        descricao: validated.descricao ?? null,
        orgao_id: auth.orgaoId,
        usuario_criador_id: auth.user.id,
      })
      .select('id, nome, descricao, created_at')
      .single();

    if (error || !notebook) {
      console.error('POST /api/notebooks error:', error);
      return NextResponse.json({ error: 'Failed to create notebook' }, { status: 500 });
    }

    await logAuditSafe({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      usuarioId: auth.user.id,
      acao: 'modificacao',
      entidadeTipo: 'notebook',
      entidadeId: notebook.id,
      detalhes: {
        operacao: 'criacao',
        nome: notebook.nome,
      },
      request,
    });

    return NextResponse.json(
      {
        id: notebook.id,
        nome: notebook.nome,
        descricao: notebook.descricao,
        data_criacao: notebook.created_at,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof OrgLimitExceededError) {
      return orgLimitExceededResponse(error);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('POST /api/notebooks error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

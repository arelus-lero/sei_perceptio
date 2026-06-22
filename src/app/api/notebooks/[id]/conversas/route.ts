import { NextRequest, NextResponse } from 'next/server';

import {
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import type { ConversationSummary } from '@/types/notebook';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id: notebookId } = await context.params;

  const { data: notebook, error: notebookError } = await auth.supabase
    .from('notebook')
    .select('id')
    .eq('id', notebookId)
    .eq('orgao_id', auth.orgaoId)
    .single();

  if (notebookError || !notebook) {
    return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
  }

  const { data: conversas, error } = await auth.supabase
    .from('conversa')
    .select('id, titulo, data_criacao, data_ultima_interacao')
    .eq('notebook_id', notebookId)
    .eq('usuario_id', auth.user.id)
    .eq('orgao_id', auth.orgaoId)
    .order('data_ultima_interacao', { ascending: false });

  if (error) {
    console.error('GET /api/notebooks/[id]/conversas error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  const conversaRows = conversas ?? [];
  const conversaIds = conversaRows.map((row) => row.id);
  const messageCountByConversa = new Map<string, number>();

  if (conversaIds.length > 0) {
    const { data: mensagens, error: mensagensError } = await auth.supabase
      .from('mensagem')
      .select('conversa_id')
      .in('conversa_id', conversaIds);

    if (mensagensError) {
      console.error('GET /api/notebooks/[id]/conversas count error:', mensagensError);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    for (const row of mensagens ?? []) {
      messageCountByConversa.set(
        row.conversa_id,
        (messageCountByConversa.get(row.conversa_id) ?? 0) + 1,
      );
    }
  }

  const summaries: ConversationSummary[] = conversaRows.map((row) => ({
    id: row.id,
    titulo: row.titulo,
    data_criacao: row.data_criacao,
    data_ultima_interacao: row.data_ultima_interacao,
    mensagens_count: messageCountByConversa.get(row.id) ?? 0,
  }));

  return NextResponse.json({ conversas: summaries }, { status: 200 });
}

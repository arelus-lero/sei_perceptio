import { NextRequest, NextResponse } from 'next/server';

import {
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import type { ConversationDetail } from '@/types/notebook';

interface RouteContext {
  params: Promise<{ id: string; conversaId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id: notebookId, conversaId } = await context.params;

  const { data: conversa, error: conversaError } = await auth.supabase
    .from('conversa')
    .select('id, titulo, data_criacao, data_ultima_interacao, notebook_id, usuario_id')
    .eq('id', conversaId)
    .eq('notebook_id', notebookId)
    .eq('usuario_id', auth.user.id)
    .eq('orgao_id', auth.orgaoId)
    .single();

  if (conversaError || !conversa) {
    return NextResponse.json({ error: 'Conversa not found' }, { status: 404 });
  }

  const { data: mensagens, error: mensagensError } = await auth.supabase
    .from('mensagem')
    .select('id, role, conteudo, data_criacao')
    .eq('conversa_id', conversaId)
    .order('data_criacao', { ascending: true });

  if (mensagensError) {
    console.error('GET conversa detail error:', mensagensError);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  const visibleMessages = (mensagens ?? []).filter(
    (row): row is typeof row & { role: 'user' | 'assistant' | 'system' } =>
      row.role === 'user' || row.role === 'assistant' || row.role === 'system',
  );

  const detail: ConversationDetail = {
    id: conversa.id,
    titulo: conversa.titulo,
    data_criacao: conversa.data_criacao,
    data_ultima_interacao: conversa.data_ultima_interacao,
    mensagens_count: visibleMessages.length,
    mensagens: visibleMessages.map((row) => ({
      id: row.id,
      role: row.role,
      conteudo: row.conteudo,
      data_criacao: row.data_criacao,
    })),
  };

  return NextResponse.json({ conversa: detail }, { status: 200 });
}

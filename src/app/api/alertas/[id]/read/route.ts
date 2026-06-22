import { NextRequest, NextResponse } from 'next/server';

import {
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const { id } = await context.params;

  const { data: existing, error: existingError } = await auth.supabase
    .from('alerta')
    .select(
      `
      id,
      monitoramento!inner (
        usuario_id
      )
    `,
    )
    .eq('id', id)
    .eq('orgao_id', auth.orgaoId)
    .maybeSingle();

  if (existingError) {
    console.error('PATCH /api/alertas/[id]/read lookup error:', existingError);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 });
  }

  const monitoramento = existing.monitoramento as
    | { usuario_id: string }
    | { usuario_id: string }[];

  const usuarioId = Array.isArray(monitoramento)
    ? monitoramento[0]?.usuario_id
    : monitoramento.usuario_id;

  if (usuarioId !== auth.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: alerta, error } = await auth.supabase
    .from('alerta')
    .update({ lido: true })
    .eq('id', id)
    .eq('orgao_id', auth.orgaoId)
    .select('id, lido')
    .single();

  if (error || !alerta) {
    console.error('PATCH /api/alertas/[id]/read error:', error);
    return NextResponse.json({ error: 'Falha ao marcar alerta como lido' }, { status: 500 });
  }

  return NextResponse.json({ alerta }, { status: 200 });
}

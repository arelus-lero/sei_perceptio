import { NextRequest, NextResponse } from 'next/server';

import {
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import type { MonitoramentoListItem } from '@/types/monitoring';

export async function GET(request: NextRequest) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const ativoParam = request.nextUrl.searchParams.get('ativo');
  const ativoFilter =
    ativoParam === 'true' ? true : ativoParam === 'false' ? false : undefined;

  let query = auth.supabase
    .from('monitoramento')
    .select(
      `
      id,
      processo_id,
      intervalo_verificacao,
      ativo,
      data_cadastro,
      processo!inner (
        nup,
        status,
        unidade_atual
      )
    `,
    )
    .eq('usuario_id', auth.user.id)
    .eq('orgao_id', auth.orgaoId)
    .order('data_cadastro', { ascending: false });

  if (ativoFilter !== undefined) {
    query = query.eq('ativo', ativoFilter);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error('GET /api/monitoramento error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  const monitoramentos: MonitoramentoListItem[] = (rows ?? []).map((row) => {
    const processo = row.processo as
      | { nup: string; status: MonitoramentoListItem['status']; unidade_atual: string }
      | { nup: string; status: MonitoramentoListItem['status']; unidade_atual: string }[];

    const processoData = Array.isArray(processo) ? processo[0] : processo;

    return {
      id: row.id,
      processo_id: row.processo_id,
      nup: processoData?.nup ?? '',
      status: processoData?.status ?? 'aberto',
      unidade_atual: processoData?.unidade_atual ?? '',
      intervalo_verificacao: row.intervalo_verificacao,
      ativo: row.ativo,
      data_cadastro: row.data_cadastro,
    };
  });

  return NextResponse.json({ monitoramentos }, { status: 200 });
}

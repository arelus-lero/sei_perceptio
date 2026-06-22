import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import type { AlertaListItem } from '@/types/monitoring';

const QuerySchema = z.object({
  lido: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  limite: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const parsed = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    let query = auth.supabase
      .from('alerta')
      .select(
        `
        id,
        monitoramento_id,
        tipo_evento,
        processo_id,
        descricao,
        lido,
        data_criacao,
        monitoramento!inner (
          usuario_id
        ),
        processo!inner (
          nup
        )
      `,
        { count: 'exact' },
      )
      .eq('orgao_id', auth.orgaoId)
      .eq('monitoramento.usuario_id', auth.user.id)
      .order('data_criacao', { ascending: false })
      .range(parsed.offset, parsed.offset + parsed.limite - 1);

    if (parsed.lido !== undefined) {
      query = query.eq('lido', parsed.lido);
    }

    const { data: rows, error, count } = await query;

    if (error) {
      console.error('GET /api/alertas error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const { count: unreadCount, error: unreadError } = await auth.supabase
      .from('alerta')
      .select('id, monitoramento!inner(usuario_id)', { count: 'exact', head: true })
      .eq('orgao_id', auth.orgaoId)
      .eq('monitoramento.usuario_id', auth.user.id)
      .eq('lido', false);

    if (unreadError) {
      console.error('GET /api/alertas unread count error:', unreadError);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const alertas: AlertaListItem[] = (rows ?? []).map((row) => {
      const processo = row.processo as { nup: string } | { nup: string }[] | null;
      const nup = Array.isArray(processo) ? processo[0]?.nup : processo?.nup;

      return {
        id: row.id,
        monitoramento_id: row.monitoramento_id,
        tipo_evento: row.tipo_evento,
        processo_id: row.processo_id,
        nup: nup ?? '',
        descricao: row.descricao,
        lido: row.lido,
        data_criacao: row.data_criacao,
      };
    });

    return NextResponse.json(
      {
        alertas,
        total: count ?? alertas.length,
        total_nao_lidos: unreadCount ?? 0,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('GET /api/alertas error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

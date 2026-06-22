import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { getProcessoTimeline } from '@/lib/db/queries/timeline';
import { nupFromRouteParam } from '@/lib/utils/processo-url';
import { validarNup } from '@/lib/utils/nup';

const QuerySchema = z.object({
  unidade: z.string().min(1).optional(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

interface RouteContext {
  params: Promise<{ nup: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const routeNup = (await context.params).nup;
    const nup = nupFromRouteParam(routeNup);

    if (!validarNup(nup)) {
      return NextResponse.json({ error: 'NUP inválido' }, { status: 400 });
    }

    const query = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    let timeline;
    try {
      timeline = await getProcessoTimeline(auth.supabase, auth.orgaoId, nup, {
        unidade: query.unidade,
        data_inicio: query.data_inicio,
        data_fim: query.data_fim,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar timeline';
      if (message.includes('sigiloso')) {
        return forbiddenResponse(message);
      }
      throw error;
    }

    if (!timeline) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    return NextResponse.json(
      {
        nup: timeline.nup,
        processo_id: timeline.processo_id,
        tipo_processo_desc: timeline.tipo_processo_desc,
        status: timeline.status,
        unidades: timeline.unidades,
        eventos: timeline.eventos,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('GET /api/processos/[nup]/timeline error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

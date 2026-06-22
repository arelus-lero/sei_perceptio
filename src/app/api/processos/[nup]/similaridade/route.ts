import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { buscarProcessosSimilares } from '@/lib/db/queries/similaridade';
import { nupFromRouteParam } from '@/lib/utils/processo-url';
import { validarNup } from '@/lib/utils/nup';

const QuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(50).optional().default(20),
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

    let resultado;
    try {
      resultado = await buscarProcessosSimilares(
        auth.supabase,
        auth.orgaoId,
        nup,
        query.limite,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro na busca por semelhança';
      if (message.includes('sigiloso')) {
        return forbiddenResponse(message);
      }
      throw error;
    }

    if (!resultado) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('GET /api/processos/[nup]/similaridade error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

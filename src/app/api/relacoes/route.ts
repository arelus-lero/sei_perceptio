import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { getProcessoRelacoesGraph } from '@/lib/db/queries/relacoes';
import { validarNup } from '@/lib/utils/nup';

const QuerySchema = z.object({
  nup: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await getApiAuthContext(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    const query = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    if (!validarNup(query.nup)) {
      return NextResponse.json({ error: 'NUP inválido' }, { status: 400 });
    }

    let graph;
    try {
      graph = await getProcessoRelacoesGraph(
        auth.supabase,
        auth.orgaoId,
        query.nup,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao montar grafo';
      if (message.includes('sigiloso')) {
        return forbiddenResponse(message);
      }
      throw error;
    }

    if (!graph) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    return NextResponse.json(graph, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('GET /api/relacoes error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import { getProcessoFluxoTramitacao } from '@/lib/db/queries/relacoes';
import { nupFromRouteParam } from '@/lib/utils/processo-url';
import { validarNup } from '@/lib/utils/nup';

interface RouteContext {
  params: Promise<{ nup: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getApiAuthContext(request);
  if (!auth) {
    return unauthorizedResponse();
  }

  const routeNup = (await context.params).nup;
  const nup = nupFromRouteParam(routeNup);

  if (!validarNup(nup)) {
    return NextResponse.json({ error: 'NUP inválido' }, { status: 400 });
  }

  try {
    const fluxo = await getProcessoFluxoTramitacao(
      auth.supabase,
      auth.orgaoId,
      nup,
    );

    if (!fluxo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    return NextResponse.json(fluxo, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao analisar fluxo';
    if (message.includes('sigiloso')) {
      return forbiddenResponse(message);
    }

    console.error('GET /api/processos/[nup]/fluxo error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

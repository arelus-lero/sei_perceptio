import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  forbiddenResponse,
  getApiAuthContext,
  unauthorizedResponse,
} from '@/lib/auth/api-context';
import type { MonitoramentoIntervalo } from '@/lib/db/schema';
import { checkProcessoChanges } from '@/lib/monitoring/check-processo';
import { nupFromRouteParam } from '@/lib/utils/processo-url';
import { validarNup } from '@/lib/utils/nup';

const MonitorSchema = z.object({
  intervalo_verificacao: z.enum(['1h', '6h', '24h']),
});

interface RouteContext {
  params: Promise<{ nup: string }>;
}

async function resolveProcesso(
  auth: NonNullable<Awaited<ReturnType<typeof getApiAuthContext>>>,
  nup: string,
) {
  const { data: processo, error } = await auth.supabase
    .from('processo')
    .select('id, nup, sigiloso, tipo_processo_codigo')
    .eq('nup', nup)
    .eq('orgao_id', auth.orgaoId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return processo;
}

export async function POST(request: NextRequest, context: RouteContext) {
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

    const body = await request.json();
    const validated = MonitorSchema.parse(body);

    const processo = await resolveProcesso(auth, nup);
    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    if (processo.sigiloso || processo.tipo_processo_codigo === '100001101') {
      return forbiddenResponse('Processo sigiloso não pode ser monitorado');
    }

    const { data: monitoramento, error: upsertError } = await auth.supabase
      .from('monitoramento')
      .upsert(
        {
          usuario_id: auth.user.id,
          processo_id: processo.id,
          intervalo_verificacao: validated.intervalo_verificacao as MonitoramentoIntervalo,
          ativo: true,
          orgao_id: auth.orgaoId,
        },
        { onConflict: 'usuario_id,processo_id' },
      )
      .select('id, ativo')
      .single();

    if (upsertError || !monitoramento) {
      console.error('POST monitor upsert error:', upsertError);
      return NextResponse.json({ error: 'Falha ao registrar monitoramento' }, { status: 500 });
    }

    await checkProcessoChanges({
      supabase: auth.supabase,
      processoId: processo.id,
      orgaoId: auth.orgaoId,
      monitoramentoIds: [monitoramento.id],
    });

    return NextResponse.json(
      {
        monitoramento_id: monitoramento.id,
        status: monitoramento.ativo ? 'ativo' : 'inativo',
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('POST /api/processos/[nup]/monitor error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const processo = await resolveProcesso(auth, nup);
    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 });
    }

    const { error } = await auth.supabase
      .from('monitoramento')
      .update({ ativo: false })
      .eq('usuario_id', auth.user.id)
      .eq('processo_id', processo.id)
      .eq('orgao_id', auth.orgaoId);

    if (error) {
      console.error('DELETE monitor error:', error);
      return NextResponse.json({ error: 'Falha ao desativar monitoramento' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/processos/[nup]/monitor error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

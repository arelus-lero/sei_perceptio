import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  requireApiAuth,
  requireRole,
} from '@/lib/auth/api-context';
import { logAuditSafe } from '@/lib/governance/audit-log';
import {
  RETENCAO_ACOES,
  RETENCAO_REGRA_TIPOS,
  RETENCAO_TIPO_ENTIDADE,
} from '@/lib/governance/constants';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';
import type { PoliticaRetencaoItem } from '@/types/governance';

const RegraSchema = z.object({
  tipo: z.enum(RETENCAO_REGRA_TIPOS),
  valor: z.number().int().min(1).max(36500),
});

const CreatePoliticaSchema = z.object({
  nome: z.string().min(2).max(200),
  tipo_entidade: z.enum(RETENCAO_TIPO_ENTIDADE),
  regra: RegraSchema,
  acao: z.enum(RETENCAO_ACOES),
  ativo: z.boolean().optional().default(true),
});

function mapPoliticaRow(row: {
  id: string;
  nome: string;
  tipo_entidade: string;
  regra: PoliticaRetencaoItem['regra'];
  acao: PoliticaRetencaoItem['acao'];
  ativo: boolean;
  criado_por_id: string;
  created_at: string;
}): PoliticaRetencaoItem {
  return {
    id: row.id,
    nome: row.nome,
    tipo_entidade: row.tipo_entidade,
    regra: row.regra,
    acao: row.acao,
    ativo: row.ativo,
    criado_por_id: row.criado_por_id,
    created_at: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'GET /api/admin/retencao');

  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(
      auth,
      ['admin'],
      'Somente administradores podem consultar políticas de retenção',
    );
    if (roleError) {
      return roleError;
    }

    const { data, error } = await auth.supabase
      .from('politica_retensao')
      .select('id, nome, tipo_entidade, regra, acao, ativo, criado_por_id, created_at')
      .eq('orgao_id', auth.orgaoId)
      .order('created_at', { ascending: false });

    if (error) {
      logError(log, 'GET /api/admin/retencao error', error);
      return withRequestIdHeader(
        NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
        requestId,
      );
    }

    return withRequestIdHeader(
      NextResponse.json(
        {
          data: {
            politicas: (data ?? []).map((row) =>
              mapPoliticaRow(row as Parameters<typeof mapPoliticaRow>[0]),
            ),
          },
        },
        { status: 200 },
      ),
      requestId,
    );
  } catch (error) {
    logError(log, 'GET /api/admin/retencao unexpected error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

export async function POST(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/admin/retencao');

  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(
      auth,
      ['admin'],
      'Somente administradores podem criar políticas de retenção',
    );
    if (roleError) {
      return roleError;
    }

    const body = await request.json();
    const validated = CreatePoliticaSchema.parse(body);

    const { data, error } = await auth.supabase
      .from('politica_retensao')
      .insert({
        orgao_id: auth.orgaoId,
        nome: validated.nome,
        tipo_entidade: validated.tipo_entidade,
        regra: validated.regra,
        acao: validated.acao,
        ativo: validated.ativo,
        criado_por_id: auth.user.id,
      })
      .select('id, nome, tipo_entidade, regra, acao, ativo, criado_por_id, created_at')
      .single();

    if (error || !data) {
      logError(log, 'POST /api/admin/retencao error', error);
      return withRequestIdHeader(
        NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
        requestId,
      );
    }

    await logAuditSafe({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      usuarioId: auth.user.id,
      acao: 'configuracao',
      entidadeTipo: 'politica_retensao',
      entidadeId: data.id,
      detalhes: {
        operacao: 'criacao',
        nome: validated.nome,
        tipo_entidade: validated.tipo_entidade,
        regra: validated.regra,
        acao: validated.acao,
        ativo: validated.ativo,
      },
      request,
    });

    return withRequestIdHeader(
      NextResponse.json(
        { data: mapPoliticaRow(data as Parameters<typeof mapPoliticaRow>[0]) },
        { status: 201 },
      ),
      requestId,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withRequestIdHeader(
        NextResponse.json({ error: error.issues }, { status: 400 }),
        requestId,
      );
    }

    logError(log, 'POST /api/admin/retencao unexpected error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

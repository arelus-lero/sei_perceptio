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

const RegraSchema = z.object({
  tipo: z.enum(RETENCAO_REGRA_TIPOS),
  valor: z.number().int().min(1).max(36500),
});

const UpdatePoliticaSchema = z.object({
  nome: z.string().min(2).max(200).optional(),
  tipo_entidade: z.enum(RETENCAO_TIPO_ENTIDADE).optional(),
  regra: RegraSchema.optional(),
  acao: z.enum(RETENCAO_ACOES).optional(),
  ativo: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { requestId, log } = getRouteLogger(request, 'PATCH /api/admin/retencao/[id]');

  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(
      auth,
      ['admin'],
      'Somente administradores podem alterar políticas de retenção',
    );
    if (roleError) {
      return roleError;
    }

    const { id } = await context.params;
    const body = await request.json();
    const validated = UpdatePoliticaSchema.parse(body);

    if (
      validated.nome === undefined
      && validated.tipo_entidade === undefined
      && validated.regra === undefined
      && validated.acao === undefined
      && validated.ativo === undefined
    ) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await auth.supabase
      .from('politica_retensao')
      .select('id, nome, tipo_entidade, regra, acao, ativo')
      .eq('id', id)
      .eq('orgao_id', auth.orgaoId)
      .maybeSingle();

    if (existingError) {
      logError(log, 'PATCH /api/admin/retencao/[id] fetch error', existingError);
      return withRequestIdHeader(
        NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
        requestId,
      );
    }

    if (!existing) {
      return NextResponse.json({ error: 'Política não encontrada' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (validated.nome !== undefined) {
      updates.nome = validated.nome;
    }
    if (validated.tipo_entidade !== undefined) {
      updates.tipo_entidade = validated.tipo_entidade;
    }
    if (validated.regra !== undefined) {
      updates.regra = validated.regra;
    }
    if (validated.acao !== undefined) {
      updates.acao = validated.acao;
    }
    if (validated.ativo !== undefined) {
      updates.ativo = validated.ativo;
    }

    const { data, error } = await auth.supabase
      .from('politica_retensao')
      .update(updates)
      .eq('id', id)
      .eq('orgao_id', auth.orgaoId)
      .select('id, nome, tipo_entidade, regra, acao, ativo, criado_por_id, created_at')
      .single();

    if (error || !data) {
      logError(log, 'PATCH /api/admin/retencao/[id] error', error);
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
      entidadeId: id,
      detalhes: {
        operacao: 'atualizacao',
        antes: existing,
        depois: updates,
      },
      request,
    });

    return withRequestIdHeader(NextResponse.json({ data }, { status: 200 }), requestId);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withRequestIdHeader(
        NextResponse.json({ error: error.issues }, { status: 400 }),
        requestId,
      );
    }

    logError(log, 'PATCH /api/admin/retencao/[id] unexpected error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

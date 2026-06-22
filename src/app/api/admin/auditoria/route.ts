import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  requireApiAuth,
  requireRole,
} from '@/lib/auth/api-context';
import {
  AUDIT_LOG_ACTIONS,
  AUDIT_LOG_RETENTION_YEARS,
} from '@/lib/governance/constants';
import type { AuditLogListItem, AuditLogListResponse } from '@/types/governance';

const QuerySchema = z.object({
  acao: z.enum(AUDIT_LOG_ACTIONS).optional(),
  entidade_tipo: z.string().min(1).max(100).optional(),
  usuario_id: z.uuid().optional(),
  data_inicio: z.iso.date().optional(),
  data_fim: z.iso.date().optional(),
  pagina: z.coerce.number().int().min(1).optional().default(1),
  por_pagina: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(
      auth,
      ['admin'],
      'Somente administradores podem consultar logs de auditoria',
    );
    if (roleError) {
      return roleError;
    }

    const parsed = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );

    const offset = (parsed.pagina - 1) * parsed.por_pagina;

    let query = auth.supabase
      .from('audit_log')
      .select(
        `
        id,
        usuario_id,
        acao,
        entidade_tipo,
        entidade_id,
        detalhes_json,
        ip_address,
        user_agent,
        data_criacao
      `,
        { count: 'exact' },
      )
      .eq('orgao_id', auth.orgaoId)
      .order('data_criacao', { ascending: false })
      .range(offset, offset + parsed.por_pagina - 1);

    if (parsed.acao) {
      query = query.eq('acao', parsed.acao);
    }

    if (parsed.entidade_tipo) {
      query = query.eq('entidade_tipo', parsed.entidade_tipo);
    }

    if (parsed.usuario_id) {
      query = query.eq('usuario_id', parsed.usuario_id);
    }

    if (parsed.data_inicio) {
      query = query.gte('data_criacao', `${parsed.data_inicio}T00:00:00.000Z`);
    }

    if (parsed.data_fim) {
      query = query.lte('data_criacao', `${parsed.data_fim}T23:59:59.999Z`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('GET /api/admin/auditoria error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const rows = data ?? [];
    const userIds = [
      ...new Set(
        rows
          .map((row) => row.usuario_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];

    const nomeByUserId = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: perfis } = await auth.supabase
        .from('perfil')
        .select('user_id, nome_completo')
        .eq('orgao_id', auth.orgaoId)
        .in('user_id', userIds);

      for (const perfil of perfis ?? []) {
        nomeByUserId.set(perfil.user_id, perfil.nome_completo);
      }
    }

    const logs: AuditLogListItem[] = rows.map((row) => ({
      id: row.id,
      usuario_id: row.usuario_id,
      usuario_nome: row.usuario_id ? nomeByUserId.get(row.usuario_id) ?? null : null,
      acao: row.acao,
      entidade_tipo: row.entidade_tipo,
      entidade_id: row.entidade_id,
      detalhes_json: (row.detalhes_json ?? {}) as Record<string, unknown>,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      data_criacao: row.data_criacao,
    }));

    const response: AuditLogListResponse = {
      logs,
      total: count ?? 0,
      pagina: parsed.pagina,
      por_pagina: parsed.por_pagina,
      retencao_anos: AUDIT_LOG_RETENTION_YEARS,
    };

    return NextResponse.json({ data: response }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('GET /api/admin/auditoria unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

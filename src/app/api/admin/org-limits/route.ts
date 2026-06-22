import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
  requireApiAuth,
  requireRole,
} from '@/lib/auth/api-context';
import { logAuditSafe } from '@/lib/governance/audit-log';
import {
  DEFAULT_MAX_FONTS_NOTEBOOK,
  DEFAULT_MAX_NOTEBOOKS,
  fetchOrgLimits,
} from '@/lib/governance/org-limits';
import type { OrgLimitsConfig } from '@/types/governance';

const UpdateOrgLimitsSchema = z
  .object({
    max_fontes_notebook: z.number().int().min(1).max(10000).optional(),
    max_notebooks: z.number().int().min(1).max(100000).optional(),
  })
  .refine(
    (value) =>
      value.max_fontes_notebook !== undefined || value.max_notebooks !== undefined,
    { message: 'Informe ao menos um limite para atualizar' },
  );

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(
      auth,
      ['admin'],
      'Somente administradores podem consultar limites do órgão',
    );
    if (roleError) {
      return roleError;
    }

    const { data, error } = await auth.supabase
      .from('org_limits')
      .select('max_fontes_notebook, max_notebooks, updated_at, updated_by_id')
      .eq('orgao_id', auth.orgaoId)
      .maybeSingle();

    if (error) {
      console.error('GET /api/admin/org-limits error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const limits: OrgLimitsConfig & {
      updated_at: string | null;
      updated_by_id: string | null;
    } = {
      max_fontes_notebook: data?.max_fontes_notebook ?? DEFAULT_MAX_FONTS_NOTEBOOK,
      max_notebooks: data?.max_notebooks ?? DEFAULT_MAX_NOTEBOOKS,
      updated_at: data?.updated_at ?? null,
      updated_by_id: data?.updated_by_id ?? null,
    };

    const { data: quota, error: quotaError } = await auth.supabase.rpc(
      'check_org_quota',
      { p_orgao_id: auth.orgaoId, p_notebook_id: null },
    );

    if (quotaError) {
      console.error('GET /api/admin/org-limits quota error:', quotaError);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        limits,
        usage: {
          notebook_count: Number((quota as Record<string, unknown>).notebook_count ?? 0),
        },
      },
    });
  } catch (error) {
    console.error('GET /api/admin/org-limits unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const roleError = requireRole(
      auth,
      ['admin'],
      'Somente administradores podem alterar limites do órgão',
    );
    if (roleError) {
      return roleError;
    }

    const body = await request.json();
    const validated = UpdateOrgLimitsSchema.parse(body);
    const current = await fetchOrgLimits(auth.supabase, auth.orgaoId);

    const { data, error } = await auth.supabase
      .from('org_limits')
      .upsert(
        {
          orgao_id: auth.orgaoId,
          max_fontes_notebook:
            validated.max_fontes_notebook ?? current.max_fontes_notebook,
          max_notebooks: validated.max_notebooks ?? current.max_notebooks,
          updated_at: new Date().toISOString(),
          updated_by_id: auth.user.id,
        },
        { onConflict: 'orgao_id' },
      )
      .select('max_fontes_notebook, max_notebooks, updated_at')
      .single();

    if (error || !data) {
      console.error('PATCH /api/admin/org-limits error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    await logAuditSafe({
      supabase: auth.supabase,
      orgaoId: auth.orgaoId,
      usuarioId: auth.user.id,
      acao: 'configuracao',
      entidadeTipo: 'orgao',
      entidadeId: auth.orgaoId,
      detalhes: {
        operacao: 'atualizar_org_limits',
        max_fontes_notebook: data.max_fontes_notebook,
        max_notebooks: data.max_notebooks,
      },
      request,
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    console.error('PATCH /api/admin/org-limits unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

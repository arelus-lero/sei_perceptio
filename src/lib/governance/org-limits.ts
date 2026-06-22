import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_MAX_FONTS_NOTEBOOK = 300;
export const DEFAULT_MAX_NOTEBOOKS = 500;

export type OrgLimitCode = 'NOTEBOOK_LIMIT' | 'FONTE_LIMIT';

export interface OrgLimitsConfig {
  max_fontes_notebook: number;
  max_notebooks: number;
}

export interface OrgQuotaSnapshot {
  notebook_count: number;
  max_notebooks: number;
  fonte_count: number;
  max_fontes_notebook: number;
}

export class OrgLimitExceededError extends Error {
  readonly code: OrgLimitCode;
  readonly limit: number;
  readonly current: number;

  constructor(params: {
    code: OrgLimitCode;
    message: string;
    limit: number;
    current: number;
  }) {
    super(params.message);
    this.name = 'OrgLimitExceededError';
    this.code = params.code;
    this.limit = params.limit;
    this.current = params.current;
  }
}

export function canAddWithinLimit(current: number, max: number): boolean {
  return current < max;
}

export function buildNotebookLimitMessage(current: number, max: number): string {
  return `Limite de notebooks do órgão atingido (${current}/${max}). Remova notebooks inativos ou solicite ao administrador o aumento do limite.`;
}

export function buildFonteLimitMessage(current: number, max: number): string {
  return `Limite de fontes por notebook atingido (${current}/${max}). Remova fontes não utilizadas ou solicite ao administrador o aumento do limite.`;
}

export async function fetchOrgQuota(
  supabase: SupabaseClient,
  orgaoId: string,
  notebookId?: string,
): Promise<OrgQuotaSnapshot> {
  const { data, error } = await supabase.rpc('check_org_quota', {
    p_orgao_id: orgaoId,
    p_notebook_id: notebookId ?? null,
  });

  if (error) {
    throw new Error(`Falha ao consultar quota do órgão: ${error.message}`);
  }

  const payload = data as Record<string, unknown>;

  return {
    notebook_count: Number(payload.notebook_count ?? 0),
    max_notebooks: Number(payload.max_notebooks ?? DEFAULT_MAX_NOTEBOOKS),
    fonte_count: Number(payload.fonte_count ?? 0),
    max_fontes_notebook: Number(
      payload.max_fontes_notebook ?? DEFAULT_MAX_FONTS_NOTEBOOK,
    ),
  };
}

export async function fetchOrgLimits(
  supabase: SupabaseClient,
  orgaoId: string,
): Promise<OrgLimitsConfig> {
  const { data, error } = await supabase
    .from('org_limits')
    .select('max_fontes_notebook, max_notebooks')
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao carregar limites do órgão: ${error.message}`);
  }

  return {
    max_fontes_notebook: data?.max_fontes_notebook ?? DEFAULT_MAX_FONTS_NOTEBOOK,
    max_notebooks: data?.max_notebooks ?? DEFAULT_MAX_NOTEBOOKS,
  };
}

export async function assertCanCreateNotebook(
  supabase: SupabaseClient,
  orgaoId: string,
): Promise<void> {
  const quota = await fetchOrgQuota(supabase, orgaoId);

  if (!canAddWithinLimit(quota.notebook_count, quota.max_notebooks)) {
    throw new OrgLimitExceededError({
      code: 'NOTEBOOK_LIMIT',
      message: buildNotebookLimitMessage(
        quota.notebook_count,
        quota.max_notebooks,
      ),
      limit: quota.max_notebooks,
      current: quota.notebook_count,
    });
  }
}

export async function assertCanAddFonte(
  supabase: SupabaseClient,
  orgaoId: string,
  notebookId: string,
): Promise<void> {
  const quota = await fetchOrgQuota(supabase, orgaoId, notebookId);

  if (!canAddWithinLimit(quota.fonte_count, quota.max_fontes_notebook)) {
    throw new OrgLimitExceededError({
      code: 'FONTE_LIMIT',
      message: buildFonteLimitMessage(
        quota.fonte_count,
        quota.max_fontes_notebook,
      ),
      limit: quota.max_fontes_notebook,
      current: quota.fonte_count,
    });
  }
}

export function orgLimitExceededResponse(error: OrgLimitExceededError): Response {
  return Response.json(
    {
      error: error.message,
      code: error.code,
      limit: error.limit,
      current: error.current,
    },
    { status: 422 },
  );
}

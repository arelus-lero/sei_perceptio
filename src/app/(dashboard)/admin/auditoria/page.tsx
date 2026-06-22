import { ClipboardList } from 'lucide-react';
import { redirect } from 'next/navigation';

import { AuditLogTable } from '@/components/governance/audit-log-table';
import { PageTitle } from '@/components/layout/headings';
import { canAccessAdminRoutes } from '@/lib/auth/rbac';
import { getServerAuthContext } from '@/lib/auth/server-context';
import { AUDIT_LOG_RETENTION_YEARS } from '@/lib/governance/constants';
import type { AuditLogListResponse } from '@/types/governance';

export default async function AdminAuditoriaPage() {
  const auth = await getServerAuthContext();
  if (!auth) {
    redirect('/login');
  }

  if (!canAccessAdminRoutes(auth.role)) {
    redirect('/dashboard');
  }

  const { data, error, count } = await auth.supabase
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
    .range(0, 49);

  if (error) {
    console.error('Admin auditoria page error:', error);
    throw error;
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

  const initialData: AuditLogListResponse = {
    logs: rows.map((row) => ({
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
    })),
    total: count ?? 0,
    pagina: 1,
    por_pagina: 50,
    retencao_anos: AUDIT_LOG_RETENTION_YEARS,
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" aria-hidden />
          <PageTitle>Logs de auditoria</PageTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Rastreabilidade de ingestão, consultas RAG, modificações e exportações.
          Registros imutáveis com retenção mínima de {AUDIT_LOG_RETENTION_YEARS} anos.
        </p>
      </header>

      <AuditLogTable initialData={initialData} />
    </div>
  );
}

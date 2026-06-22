import 'server-only';

import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { AuditLogAcao } from '@/lib/db/schema';
import { createRequestLogger, getRequestId, logError } from '@/lib/logger';

export interface WriteAuditLogInput {
  supabase: SupabaseClient;
  orgaoId: string;
  usuarioId: string;
  acao: AuditLogAcao;
  entidadeTipo: string;
  entidadeId?: string | null;
  detalhes?: Record<string, unknown>;
  request?: NextRequest;
}

export interface RequestAuditMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export function extractRequestAuditMetadata(
  request?: NextRequest,
): RequestAuditMetadata {
  if (!request) {
    return { ipAddress: null, userAgent: null };
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress =
    forwarded?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? null;
  const userAgent = request.headers.get('user-agent');

  return {
    ipAddress,
    userAgent,
  };
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<string> {
  const { ipAddress, userAgent } = extractRequestAuditMetadata(input.request);

  const { data, error } = await input.supabase
    .from('audit_log')
    .insert({
      usuario_id: input.usuarioId,
      acao: input.acao,
      entidade_tipo: input.entidadeTipo,
      entidade_id: input.entidadeId ?? null,
      detalhes_json: input.detalhes ?? {},
      ip_address: ipAddress,
      user_agent: userAgent,
      orgao_id: input.orgaoId,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Falha ao registrar audit_log');
  }

  return data.id;
}

/** Registra auditoria sem interromper o fluxo principal em caso de falha. */
export async function logAuditSafe(input: WriteAuditLogInput): Promise<void> {
  try {
    await writeAuditLog(input);
  } catch (error) {
    const requestId = input.request ? getRequestId(input.request) : crypto.randomUUID();
    const log = createRequestLogger(requestId, { route: 'audit_log' });
    logError(log, 'audit_log write failed', error, {
      acao: input.acao,
      entidade_tipo: input.entidadeTipo,
      entidade_id: input.entidadeId ?? null,
    });
  }
}

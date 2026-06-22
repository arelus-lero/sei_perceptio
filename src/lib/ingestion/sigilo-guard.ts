import type { SupabaseClient } from '@supabase/supabase-js';

import { extractSeiMetadata } from '@/lib/ingestion/metadata-extractor';
import type { UserRole } from '@/lib/db/schema';
import {
  SIGILO_TIPO_PROCESSO_CODIGO,
  type SigiloCheckResult,
} from '@/types/anonymization';

export class SigiloBlockedError extends Error {
  readonly code = 'SIGILO_BLOCKED';

  constructor(message: string) {
    super(message);
    this.name = 'SigiloBlockedError';
  }
}

function parseExceptionOrgaoIds(): Set<string> {
  const raw = process.env.SIGILO_DPO_EXCEPTION_ORGAO_IDS ?? '';
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function hasDpoException(orgaoId: string): boolean {
  return parseExceptionOrgaoIds().has(orgaoId);
}

interface CheckSigiloIngestionParams {
  supabase: SupabaseClient;
  orgaoId: string;
  texto: string;
  userRole: UserRole | null;
  sigiloExceptionJustificativa?: string;
}

async function lookupProcessoSigilo(
  supabase: SupabaseClient,
  orgaoId: string,
  nup: string,
): Promise<{ sigiloso: boolean; tipoCodigo: string | null }> {
  const { data } = await supabase
    .from('processo')
    .select('sigiloso, tipo_processo_codigo')
    .eq('nup', nup)
    .eq('orgao_id', orgaoId)
    .maybeSingle();

  if (!data) {
    return { sigiloso: false, tipoCodigo: null };
  }

  return {
    sigiloso: data.sigiloso === true,
    tipoCodigo: data.tipo_processo_codigo,
  };
}

export async function checkSigiloIngestion(
  params: CheckSigiloIngestionParams,
): Promise<SigiloCheckResult> {
  const metadata = extractSeiMetadata(params.texto);
  let tipoCodigo = metadata.tipo_processo_codigo;
  let isSigiloso = metadata.sigiloso_detectado;

  if (metadata.nup) {
    const processo = await lookupProcessoSigilo(
      params.supabase,
      params.orgaoId,
      metadata.nup,
    );
    if (processo.tipoCodigo) {
      tipoCodigo = processo.tipoCodigo;
    }
    if (processo.sigiloso || processo.tipoCodigo === SIGILO_TIPO_PROCESSO_CODIGO) {
      isSigiloso = true;
    }
  }

  if (!isSigiloso && tipoCodigo !== SIGILO_TIPO_PROCESSO_CODIGO) {
    return { blocked: false, exception_applied: false };
  }

  const justificativa = params.sigiloExceptionJustificativa?.trim();
  const adminOverride =
    params.userRole === 'admin' && justificativa !== undefined && justificativa.length >= 10;
  const orgaoException = hasDpoException(params.orgaoId);

  if (adminOverride || orgaoException) {
    return {
      blocked: false,
      exception_applied: true,
      tipo_processo_codigo: tipoCodigo ?? SIGILO_TIPO_PROCESSO_CODIGO,
    };
  }

  return {
    blocked: true,
    exception_applied: false,
    tipo_processo_codigo: tipoCodigo ?? SIGILO_TIPO_PROCESSO_CODIGO,
    reason:
      'Ingestão bloqueada: processo sigiloso (código 100001101). Exceção DPO necessária.',
  };
}

export async function assertSigiloIngestionAllowed(
  params: CheckSigiloIngestionParams,
): Promise<SigiloCheckResult> {
  const result = await checkSigiloIngestion(params);
  if (result.blocked) {
    throw new SigiloBlockedError(result.reason ?? 'Processo sigiloso bloqueado.');
  }
  return result;
}

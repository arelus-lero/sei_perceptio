import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserRole } from '@/lib/db/schema';
import { SIGILO_TIPO_PROCESSO_CODIGO } from '@/types/anonymization';
import type { NotebookSigiloInfo } from '@/types/notebook-share';

interface FonteRow {
  id: string;
  documento_sei_id: string | null;
  metadados_json: Record<string, unknown> | null;
}

interface ProcessoSigiloRow {
  nup: string;
  sigiloso: boolean;
  tipo_processo_codigo: string;
}

export interface SigiloValidationResult {
  allowed: boolean;
  message?: string;
}

function extractNupFromMetadata(metadados: Record<string, unknown> | null): string | null {
  if (!metadados) {
    return null;
  }

  const nup = metadados.nup ?? metadados.numero_nup;
  return typeof nup === 'string' && nup.length > 0 ? nup : null;
}

function isSigiloMetadata(metadados: Record<string, unknown> | null): boolean {
  if (!metadados) {
    return false;
  }

  if (metadados.sigiloso === true) {
    return true;
  }

  return metadados.tipo_processo_codigo === SIGILO_TIPO_PROCESSO_CODIGO;
}

function isProcessoSigiloso(processo: ProcessoSigiloRow): boolean {
  return (
    processo.sigiloso === true
    || processo.tipo_processo_codigo === SIGILO_TIPO_PROCESSO_CODIGO
  );
}

/**
 * RF-042: verifica se fontes do notebook referenciam processos sigilosos (100001101).
 */
export async function scanNotebookSigilo(
  supabase: SupabaseClient,
  notebookId: string,
  orgaoId: string,
): Promise<NotebookSigiloInfo> {
  try {
    const { data: fontes, error } = await supabase
      .from('fonte')
      .select('id, documento_sei_id, metadados_json')
      .eq('notebook_id', notebookId)
      .eq('orgao_id', orgaoId);

    if (error) {
      throw new Error(error.message);
    }

    const fontesSigilosas: string[] = [];
    const nupsSigilosos = new Set<string>();

    for (const fonte of (fontes ?? []) as FonteRow[]) {
      if (!isSigiloMetadata(fonte.metadados_json)) {
        continue;
      }

      fontesSigilosas.push(fonte.id);
      const nup = extractNupFromMetadata(fonte.metadados_json);
      nupsSigilosos.add(nup ?? `fonte:${fonte.id}`);
    }

    const documentoIds = (fontes ?? [])
      .map((fonte) => fonte.documento_sei_id)
      .filter((id): id is string => typeof id === 'string');

    if (documentoIds.length > 0) {
      const { data: documentos, error: documentosError } = await supabase
        .from('documento')
        .select('id, processo:processo_id ( nup, sigiloso, tipo_processo_codigo )')
        .eq('orgao_id', orgaoId)
        .in('id', documentoIds);

      if (documentosError) {
        throw new Error(documentosError.message);
      }

      for (const documento of documentos ?? []) {
        const processoRaw = documento.processo;
        const processo = (
          Array.isArray(processoRaw) ? processoRaw[0] : processoRaw
        ) as ProcessoSigiloRow | null | undefined;

        if (!processo || !isProcessoSigiloso(processo)) {
          continue;
        }

        nupsSigilosos.add(processo.nup);

        const fonteVinculada = (fontes ?? []).find(
          (fonte) => fonte.documento_sei_id === documento.id,
        );

        if (fonteVinculada && !fontesSigilosas.includes(fonteVinculada.id)) {
          fontesSigilosas.push(fonteVinculada.id);
        }
      }
    }

    const contemSigiloso = fontesSigilosas.length > 0;

    return {
      contem_sigiloso: contemSigiloso,
      nups_sigilosos: [...nupsSigilosos],
      requer_confirmacao_admin: contemSigiloso,
    };
  } catch (error) {
    console.error('scanNotebookSigilo error:', error);
    throw error instanceof Error
      ? error
      : new Error('Falha ao verificar sigilo do notebook');
  }
}

function validateSigiloOperationConfirmation(
  sigilo: NotebookSigiloInfo,
  userRole: UserRole,
  confirmacao: string | undefined,
  operacaoLabel: 'compartilhamento' | 'exportação',
): SigiloValidationResult {
  if (!sigilo.contem_sigiloso) {
    return { allowed: true };
  }

  if (userRole !== 'admin') {
    return {
      allowed: false,
      message:
        `Notebook contém processos sigilosos. Somente administradores podem autorizar ${operacaoLabel} com confirmação explícita.`,
    };
  }

  const texto = confirmacao?.trim() ?? '';
  if (texto.length < 15) {
    return {
      allowed: false,
      message:
        'Confirmação obrigatória para conteúdo sigiloso (mínimo 15 caracteres descrevendo a autorização).',
    };
  }

  return { allowed: true };
}

export function validateSigiloShareConfirmation(
  sigilo: NotebookSigiloInfo,
  userRole: UserRole,
  confirmacao?: string,
): SigiloValidationResult {
  return validateSigiloOperationConfirmation(
    sigilo,
    userRole,
    confirmacao,
    'compartilhamento',
  );
}

export function validateSigiloExportConfirmation(
  sigilo: NotebookSigiloInfo,
  userRole: UserRole,
  confirmacao?: string,
): SigiloValidationResult {
  return validateSigiloOperationConfirmation(
    sigilo,
    userRole,
    confirmacao,
    'exportação',
  );
}

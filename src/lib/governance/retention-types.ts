import type { PoliticaRetencaoAcao, PoliticaRetencaoRegra } from '@/lib/db/schema';

export type RetencaoEntityTipo = 'fonte' | 'processo' | 'documento' | 'notebook';

export type RetencaoMarkerStatus =
  | 'aprovacao_pendente'
  | 'anonimizado'
  | 'dry_run_simulado';

export interface RetencaoEntityMarker {
  politica_id: string;
  politica_nome: string;
  acao: PoliticaRetencaoAcao;
  status: RetencaoMarkerStatus;
  expirado_em: string;
  marcado_em: string;
  dry_run?: boolean;
  idempotency_key: string;
}

export interface PoliticaRetencaoAtiva {
  id: string;
  orgao_id: string;
  nome: string;
  tipo_entidade: RetencaoEntityTipo;
  regra: PoliticaRetencaoRegra;
  acao: PoliticaRetencaoAcao;
  criado_por_id: string;
}

export interface RetentionCandidate {
  entidade_tipo: RetencaoEntityTipo;
  entidade_id: string;
  orgao_id: string;
  referencia_em: string;
  expirado_em: string;
  titulo: string;
}

export interface RetentionApplyResult {
  politica_id: string;
  entidade_tipo: RetencaoEntityTipo;
  entidade_id: string;
  acao: PoliticaRetencaoAcao;
  status: RetencaoMarkerStatus;
  dry_run: boolean;
  skipped: boolean;
  skip_reason?: string;
}

export interface ApplyRetentionRunSummary {
  dry_run: boolean;
  politicas_processadas: number;
  candidatos_encontrados: number;
  acoes_executadas: number;
  acoes_simuladas: number;
  acoes_ignoradas: number;
  resultados: RetentionApplyResult[];
}

export function buildRetentionIdempotencyKey(
  politicaId: string,
  entidadeId: string,
): string {
  return `retencao:${politicaId}:${entidadeId}`;
}

export function isConcludedProcessoStatus(status: string): boolean {
  return status === 'concluido' || status === 'arquivado';
}

export function computeExpirationDate(
  referenceIso: string,
  regra: PoliticaRetencaoRegra,
): Date {
  const reference = new Date(referenceIso);
  const expires = new Date(reference);
  expires.setUTCDate(expires.getUTCDate() + regra.valor);
  return expires;
}

export function isExpired(expiration: Date, now: Date = new Date()): boolean {
  return expiration.getTime() <= now.getTime();
}

export function readRetentionMarker(
  container: Record<string, unknown> | null | undefined,
): RetencaoEntityMarker | null {
  if (!container) {
    return null;
  }

  const raw = container.retencao;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const marker = raw as Partial<RetencaoEntityMarker>;
  if (
    typeof marker.politica_id !== 'string'
    || typeof marker.status !== 'string'
    || typeof marker.idempotency_key !== 'string'
  ) {
    return null;
  }

  return marker as RetencaoEntityMarker;
}

export function isRetentionAlreadyApplied(
  marker: RetencaoEntityMarker | null,
  politicaId: string,
): boolean {
  if (!marker) {
    return false;
  }

  if (marker.politica_id !== politicaId) {
    return false;
  }

  return (
    marker.status === 'aprovacao_pendente'
    || marker.status === 'anonimizado'
    || marker.status === 'dry_run_simulado'
  );
}

export function resolveDryRun(
  eventDryRun: boolean | undefined,
  envDryRun: string | undefined,
): boolean {
  if (typeof eventDryRun === 'boolean') {
    return eventDryRun;
  }
  return envDryRun === 'true' || envDryRun === '1';
}

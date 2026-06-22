import type { SupabaseClient } from '@supabase/supabase-js';

import {
  computeSimhash,
  isSimilarSimhash,
  readStoredSimhash,
  simhashSimilarity,
} from '@/lib/dedup/simhash';
import { DuplicateChecksumError, SimilarContentError } from '@/lib/dedup/dedup-errors';
import {
  isFonteSuccessfullyIngested,
} from '@/lib/ingestion/reprocess-fonte';
import type { DuplicateFonteMatch, SimilarFonteMatch } from '@/types/dedup';
import type { FonteIngestionStatus } from '@/types/ingestion';

interface FonteDedupRow {
  id: string;
  titulo: string;
  notebook_id: string;
  checksum: string | null;
  conteudo_texto: string | null;
  metadados_json: Record<string, unknown> | null;
}

function readIngestionStatus(
  metadados: Record<string, unknown> | null | undefined,
): FonteIngestionStatus {
  const raw = metadados?.status;
  if (
    raw === 'pronto'
    || raw === 'requer_ocr'
    || raw === 'erro'
    || raw === 'erro_embeddings'
    || raw === 'processando'
  ) {
    return raw;
  }

  return 'processando';
}

async function loadFontesByChecksum(
  supabase: SupabaseClient,
  orgaoId: string,
  checksum: string,
  excludeFonteId?: string,
): Promise<FonteDedupRow[]> {
  const { data, error } = await supabase
    .from('fonte')
    .select('id, titulo, notebook_id, checksum, conteudo_texto, metadados_json')
    .eq('orgao_id', orgaoId)
    .eq('checksum', checksum)
    .limit(20);

  if (error) {
    throw new Error(`Falha ao verificar checksum duplicado: ${error.message}`);
  }

  return (data ?? []).filter((row) => row.id !== excludeFonteId) as FonteDedupRow[];
}

export async function findChecksumDuplicates(
  supabase: SupabaseClient,
  orgaoId: string,
  checksum: string,
  options?: { excludeFonteId?: string },
): Promise<DuplicateFonteMatch[]> {
  const rows = await loadFontesByChecksum(
    supabase,
    orgaoId,
    checksum,
    options?.excludeFonteId,
  );

  const blocking: DuplicateFonteMatch[] = [];

  for (const row of rows) {
    const ingested = await isFonteSuccessfullyIngested(
      supabase,
      row.id,
      row.metadados_json,
    );

    if (!ingested) {
      continue;
    }

    blocking.push({
      fonte_id: row.id,
      titulo: row.titulo,
      notebook_id: row.notebook_id,
      checksum: row.checksum ?? checksum,
    });
  }

  return blocking;
}

export async function findIncompleteFontesByChecksum(
  supabase: SupabaseClient,
  orgaoId: string,
  checksum: string,
): Promise<FonteDedupRow[]> {
  const rows = await loadFontesByChecksum(supabase, orgaoId, checksum);
  const incomplete: FonteDedupRow[] = [];

  for (const row of rows) {
    const ingested = await isFonteSuccessfullyIngested(
      supabase,
      row.id,
      row.metadados_json,
    );

    if (!ingested) {
      incomplete.push(row);
    }
  }

  return incomplete;
}

export async function findIncompleteFonteByChecksum(
  supabase: SupabaseClient,
  orgaoId: string,
  checksum: string,
  notebookId?: string,
): Promise<FonteDedupRow | null> {
  const rows = await loadFontesByChecksum(supabase, orgaoId, checksum);

  const sameNotebook = rows.filter((row) => row.notebook_id === notebookId);
  const candidates = notebookId ? sameNotebook : rows;

  for (const row of candidates) {
    const ingested = await isFonteSuccessfullyIngested(
      supabase,
      row.id,
      row.metadados_json,
    );

    if (!ingested) {
      return row;
    }
  }

  return null;
}

export async function findSimilarFontes(
  supabase: SupabaseClient,
  orgaoId: string,
  text: string,
  options?: { excludeChecksum?: string; excludeFonteId?: string },
): Promise<SimilarFonteMatch[]> {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return [];
  }

  const candidateSimhash = computeSimhash(trimmed);

  const { data, error } = await supabase
    .from('fonte')
    .select('id, titulo, notebook_id, checksum, conteudo_texto, metadados_json')
    .eq('orgao_id', orgaoId)
    .not('conteudo_texto', 'is', null)
    .limit(500);

  if (error) {
    throw new Error(`Falha ao verificar similaridade de conteúdo: ${error.message}`);
  }

  const matches: SimilarFonteMatch[] = [];

  for (const row of (data ?? []) as FonteDedupRow[]) {
    if (options?.excludeFonteId && row.id === options.excludeFonteId) {
      continue;
    }

    if (options?.excludeChecksum && row.checksum === options.excludeChecksum) {
      continue;
    }

    const ingested = await isFonteSuccessfullyIngested(
      supabase,
      row.id,
      row.metadados_json,
    );

    if (!ingested) {
      continue;
    }

    const storedSimhash = readStoredSimhash(row.metadados_json);
    const referenceSimhash =
      storedSimhash
      ?? (row.conteudo_texto && row.conteudo_texto.trim().length > 0
        ? computeSimhash(row.conteudo_texto)
        : null);

    if (!referenceSimhash) {
      continue;
    }

    if (!isSimilarSimhash(candidateSimhash, referenceSimhash)) {
      continue;
    }

    matches.push({
      fonte_id: row.id,
      titulo: row.titulo,
      notebook_id: row.notebook_id,
      checksum: row.checksum,
      similarity: simhashSimilarity(candidateSimhash, referenceSimhash),
    });
  }

  return matches.sort((left, right) => right.similarity - left.similarity);
}

interface AssertUploadDedupParams {
  supabase: SupabaseClient;
  orgaoId: string;
  checksum: string;
  texto: string | null;
  confirmChecksumDuplicate?: boolean;
  confirmSimilarContent?: boolean;
  excludeFonteId?: string;
}

export async function assertUploadNotDuplicate(
  params: AssertUploadDedupParams,
): Promise<{ simhash: string | null }> {
  if (!params.confirmChecksumDuplicate) {
    const checksumDuplicates = await findChecksumDuplicates(
      params.supabase,
      params.orgaoId,
      params.checksum,
      { excludeFonteId: params.excludeFonteId },
    );

    if (checksumDuplicates.length > 0) {
      throw new DuplicateChecksumError(checksumDuplicates);
    }
  }

  const texto = params.texto?.trim() ?? '';

  if (texto.length === 0) {
    return { simhash: null };
  }

  const simhash = computeSimhash(texto);

  if (!params.confirmSimilarContent) {
    const similarMatches = await findSimilarFontes(
      params.supabase,
      params.orgaoId,
      texto,
      {
        excludeChecksum: params.checksum,
        excludeFonteId: params.excludeFonteId,
      },
    );

    if (similarMatches.length > 0) {
      throw new SimilarContentError(similarMatches);
    }
  }

  return { simhash };
}

export function parseUploadConfirmationFlag(value: FormDataEntryValue | null): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export { readIngestionStatus };

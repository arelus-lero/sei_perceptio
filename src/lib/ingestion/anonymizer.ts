import {
  mapPresidioEntity,
  mapSpacyLabel,
  PII_PATTERNS,
} from '@/lib/ingestion/anonymization/patterns';
import type {
  AnonymizationMode,
  AnonymizationResult,
  AnonymizeTextParams,
  DetectedEntity,
  PiiType,
} from '@/types/anonymization';
import { ALL_PII_TYPES } from '@/types/anonymization';

interface PresidioAnalyzeResult {
  entity_type: string;
  start: number;
  end: number;
  score: number;
}

interface SpacyNerEntity {
  label: string;
  start: number;
  end: number;
  score?: number;
}

function getDefaultMode(): AnonymizationMode {
  const mode = process.env.ANONYMIZATION_MODE;
  if (mode === 'redact' || mode === 'remove' || mode === 'mask') {
    return mode;
  }
  return 'mask';
}

function getEnabledPiiTypes(override?: PiiType[]): PiiType[] {
  if (override && override.length > 0) {
    return override;
  }

  const raw = process.env.ANONYMIZATION_PII_TYPES;
  if (!raw) {
    return ALL_PII_TYPES;
  }

  const parsed = raw
    .split(',')
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is PiiType =>
      ALL_PII_TYPES.includes(entry as PiiType),
    );

  return parsed.length > 0 ? parsed : ALL_PII_TYPES;
}

function detectWithRegex(texto: string, enabledTypes: PiiType[]): DetectedEntity[] {
  const entities: DetectedEntity[] = [];

  for (const { type, pattern, score } of PII_PATTERNS) {
    if (!enabledTypes.includes(type)) {
      continue;
    }

    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of texto.matchAll(regex)) {
      if (match.index === undefined) {
        continue;
      }

      const value = match[0];
      entities.push({
        type,
        start: match.index,
        end: match.index + value.length,
        score,
        source: 'regex',
        original: value,
      });
    }
  }

  return entities;
}

async function detectWithPresidio(
  texto: string,
  enabledTypes: PiiType[],
): Promise<DetectedEntity[]> {
  const baseUrl = process.env.PRESIDIO_ANALYZER_URL;
  if (!baseUrl) {
    return [];
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: texto,
      language: 'pt',
    }),
  });

  if (!response.ok) {
    throw new Error(`Presidio analyzer failed (${response.status})`);
  }

  const payload = (await response.json()) as { results?: PresidioAnalyzeResult[] };
  const results = payload.results ?? [];

  return results
    .map((item): DetectedEntity | null => {
      const mappedType = mapPresidioEntity(item.entity_type);
      if (!mappedType || !enabledTypes.includes(mappedType)) {
        return null;
      }

      return {
        type: mappedType,
        start: item.start,
        end: item.end,
        score: item.score,
        source: 'presidio',
        original: texto.slice(item.start, item.end),
      };
    })
    .filter((item): item is DetectedEntity => item !== null);
}

async function detectWithSpacy(
  texto: string,
  enabledTypes: PiiType[],
): Promise<DetectedEntity[]> {
  const baseUrl = process.env.SPACY_NER_URL;
  if (!baseUrl) {
    return [];
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/ner`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: texto,
      language: 'pt',
    }),
  });

  if (!response.ok) {
    throw new Error(`spaCy NER service failed (${response.status})`);
  }

  const payload = (await response.json()) as { entities?: SpacyNerEntity[] };
  const results = payload.entities ?? [];

  return results
    .map((item): DetectedEntity | null => {
      const mappedType = mapSpacyLabel(item.label);
      if (!mappedType || !enabledTypes.includes(mappedType)) {
        return null;
      }

      return {
        type: mappedType,
        start: item.start,
        end: item.end,
        score: item.score ?? 0.75,
        source: 'spacy',
        original: texto.slice(item.start, item.end),
      };
    })
    .filter((item): item is DetectedEntity => item !== null);
}

function mergeEntities(entities: DetectedEntity[]): DetectedEntity[] {
  const sorted = [...entities].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    const lengthA = a.end - a.start;
    const lengthB = b.end - b.start;
    if (lengthA !== lengthB) {
      return lengthB - lengthA;
    }
    return b.score - a.score;
  });

  const merged: DetectedEntity[] = [];

  for (const entity of sorted) {
    const overlaps = merged.some(
      (existing) => entity.start < existing.end && entity.end > existing.start,
    );
    if (!overlaps) {
      merged.push(entity);
    }
  }

  return merged.sort((a, b) => b.start - a.start);
}

function maskLabel(type: PiiType, mode: AnonymizationMode): string {
  if (mode === 'remove') {
    return '';
  }
  if (mode === 'redact') {
    return '████';
  }
  return `[${type}]`;
}

function applyAnonymization(
  texto: string,
  entities: DetectedEntity[],
  mode: AnonymizationMode,
): string {
  let output = texto;

  for (const entity of entities) {
    const replacement = maskLabel(entity.type, mode);
    output = `${output.slice(0, entity.start)}${replacement}${output.slice(entity.end)}`;
  }

  return output;
}

function buildStats(entities: DetectedEntity[]): AnonymizationResult['stats'] {
  const byType: Partial<Record<PiiType, number>> = {};
  for (const entity of entities) {
    byType[entity.type] = (byType[entity.type] ?? 0) + 1;
  }

  return {
    total: entities.length,
    by_type: byType,
  };
}

function resolveEngine(
  regexCount: number,
  presidioCount: number,
  spacyCount: number,
): AnonymizationResult['engine'] {
  const engines = [regexCount > 0, presidioCount > 0, spacyCount > 0].filter(Boolean).length;
  if (engines > 1) {
    return 'hybrid';
  }
  if (presidioCount > 0) {
    return 'presidio';
  }
  if (spacyCount > 0) {
    return 'spacy';
  }
  return 'regex';
}

export async function anonymizeText(params: AnonymizeTextParams): Promise<AnonymizationResult> {
  const mode = params.mode ?? getDefaultMode();
  const enabledTypes = getEnabledPiiTypes(params.piiTypes);
  const texto = params.texto;

  const regexEntities = detectWithRegex(texto, enabledTypes);
  const presidioEntities = await detectWithPresidio(texto, enabledTypes);
  const spacyEntities = await detectWithSpacy(texto, enabledTypes);

  const merged = mergeEntities([
    ...regexEntities,
    ...presidioEntities,
    ...spacyEntities,
  ]);

  const textoAnonimizado = applyAnonymization(texto, merged, mode);

  return {
    texto_original_length: texto.length,
    texto_anonimizado: textoAnonimizado,
    mode,
    entities: merged.sort((a, b) => a.start - b.start),
    stats: buildStats(merged),
    anonymized: merged.length > 0,
    engine: resolveEngine(
      regexEntities.length,
      presidioEntities.length,
      spacyEntities.length,
    ),
  };
}

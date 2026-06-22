import { getEncoding, type Tiktoken } from 'js-tiktoken';

import type { ChunkSourceMetadata, SemanticChunk } from '@/lib/rag/types';

export const CHUNK_MAX_TOKENS = 512;
export const CHUNK_OVERLAP_TOKENS = 200;
export const ENCODING = 'cl100k_base';

interface TextUnit {
  text: string;
  start: number;
  end: number;
  tokenCount: number;
}

interface ChunkingInput {
  texto: string;
  metadados: ChunkSourceMetadata;
}

let encodingCache: Tiktoken | null = null;

function getChunkEncoding(): Tiktoken {
  if (!encodingCache) {
    encodingCache = getEncoding(ENCODING);
  }

  return encodingCache;
}

function countTokens(text: string, encoding: Tiktoken): number {
  return encoding.encode(text).length;
}

function collectSemanticUnits(texto: string, encoding: Tiktoken): TextUnit[] {
  const units: TextUnit[] = [];
  const headingPattern = /^(#{2,3}\s+.+$)/gm;
  const headingMatches = [...texto.matchAll(headingPattern)];

  if (headingMatches.length === 0) {
    return collectParagraphUnits(texto, 0, encoding);
  }

  let cursor = 0;

  for (let index = 0; index < headingMatches.length; index += 1) {
    const match = headingMatches[index];
    if (!match || match.index === undefined) {
      continue;
    }

    if (match.index > cursor) {
      units.push(...collectParagraphUnits(texto.slice(cursor, match.index), cursor, encoding));
    }

    const nextIndex = headingMatches[index + 1]?.index ?? texto.length;
    const sectionText = texto.slice(match.index, nextIndex).trimEnd();
    if (sectionText.trim().length > 0) {
      const trimmedStart = match.index + sectionText.indexOf(sectionText.trim());
      const trimmedText = sectionText.trim();
      units.push({
        text: trimmedText,
        start: trimmedStart,
        end: trimmedStart + trimmedText.length,
        tokenCount: countTokens(trimmedText, encoding),
      });
    }

    cursor = nextIndex;
  }

  if (cursor < texto.length) {
    units.push(...collectParagraphUnits(texto.slice(cursor), cursor, encoding));
  }

  return units.filter((unit) => unit.text.trim().length > 0);
}

function collectParagraphUnits(
  text: string,
  offset: number,
  encoding: Tiktoken,
): TextUnit[] {
  const units: TextUnit[] = [];
  const parts = text.split(/\n\s*\n/);
  let searchFrom = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      searchFrom += part.length + 2;
      continue;
    }

    const relativeIndex = text.indexOf(trimmed, searchFrom);
    const start = offset + (relativeIndex >= 0 ? relativeIndex : searchFrom);
    const tokenCount = countTokens(trimmed, encoding);

    if (tokenCount <= CHUNK_MAX_TOKENS) {
      units.push({
        text: trimmed,
        start,
        end: start + trimmed.length,
        tokenCount,
      });
    } else {
      units.push(...collectSentenceUnits(trimmed, start, encoding));
    }

    searchFrom = relativeIndex >= 0
      ? relativeIndex + trimmed.length
      : searchFrom + part.length;
  }

  return units;
}

function collectSentenceUnits(
  text: string,
  offset: number,
  encoding: Tiktoken,
): TextUnit[] {
  const units: TextUnit[] = [];
  const parts = text.split(/(?<=[.!?])\s+/);
  let searchFrom = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const relativeIndex = text.indexOf(trimmed, searchFrom);
    const start = offset + (relativeIndex >= 0 ? relativeIndex : searchFrom);
    const tokenCount = countTokens(trimmed, encoding);

    units.push({
      text: trimmed,
      start,
      end: start + trimmed.length,
      tokenCount,
    });

    searchFrom = relativeIndex >= 0
      ? relativeIndex + trimmed.length
      : searchFrom + part.length;
  }

  return units;
}

function unitsTokenTotal(units: TextUnit[]): number {
  return units.reduce((sum, unit) => sum + unit.tokenCount, 0);
}

function takeOverlapUnits(units: TextUnit[]): TextUnit[] {
  const overlap: TextUnit[] = [];
  let tokens = 0;

  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];
    if (!unit) {
      continue;
    }
    overlap.unshift(unit);
    tokens += unit.tokenCount;
    if (tokens >= CHUNK_OVERLAP_TOKENS) {
      break;
    }
  }

  return overlap;
}

function buildChunkFromUnits(
  units: TextUnit[],
  metadados: ChunkSourceMetadata,
): SemanticChunk {
  const conteudo = units.map((unit) => unit.text).join('\n\n');
  const posicaoInicio = units[0]?.start ?? 0;
  const posicaoFim = units[units.length - 1]?.end ?? posicaoInicio;

  return {
    conteudo,
    posicao_inicio: posicaoInicio,
    posicao_fim: posicaoFim,
    metadados: {
      ...metadados,
      posicao_inicio: posicaoInicio,
      posicao_fim: posicaoFim,
    },
  };
}

export function chunkText(input: ChunkingInput): SemanticChunk[] {
  const texto = input.texto.trim();
  if (!texto) {
    return [];
  }

  const encoding = getChunkEncoding();
  const units = collectSemanticUnits(texto, encoding);

  if (units.length === 0) {
    return [{
      conteudo: texto,
      posicao_inicio: 0,
      posicao_fim: texto.length,
      metadados: {
        ...input.metadados,
        posicao_inicio: 0,
        posicao_fim: texto.length,
      },
    }];
  }

  const chunks: SemanticChunk[] = [];
  let buffer: TextUnit[] = [];
  let index = 0;

  while (index < units.length) {
    const unit = units[index];
    if (!unit) {
      index += 1;
      continue;
    }

    const candidate = [...buffer, unit];
    if (unitsTokenTotal(candidate) <= CHUNK_MAX_TOKENS || buffer.length === 0) {
      buffer = candidate;
      index += 1;
      continue;
    }

    chunks.push(buildChunkFromUnits(buffer, input.metadados));
    buffer = takeOverlapUnits(buffer);
  }

  if (buffer.length > 0) {
    chunks.push(buildChunkFromUnits(buffer, input.metadados));
  }

  return chunks;
}

export function chunkTextSimple(
  texto: string,
  metadados: ChunkSourceMetadata,
): SemanticChunk[] {
  return chunkText({ texto, metadados });
}

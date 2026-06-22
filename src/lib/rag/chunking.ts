import { getEncoding, type Tiktoken } from 'js-tiktoken';

import type { ChunkSourceMetadata } from '@/lib/rag/types';

export const CHUNK_MAX_TOKENS = 512;
export const OVERLAP_STRUCTURED = 80;
export const OVERLAP_FALLBACK = 200;
export const MIN_USEFUL_TOKENS = 20;
export const ENCODING = 'cl100k_base';

/** @deprecated Use OVERLAP_FALLBACK */
export const CHUNK_OVERLAP_TOKENS = OVERLAP_FALLBACK;

export interface ChunkMetadata extends ChunkSourceMetadata {
  posicao_inicio: number;
  posicao_fim: number;
}

export interface Chunk {
  conteudo: string;
  tokens: number;
  posicao_inicio: number;
  posicao_fim: number;
  metadados: ChunkMetadata;
}

interface TextUnit {
  text: string;
  start: number;
  end: number;
  tokenCount: number;
  splitLevel: 'structured' | 'fallback';
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
        splitLevel: 'structured',
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
        splitLevel: 'structured',
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
      splitLevel: 'fallback',
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

function resolveOverlapForBuffer(units: TextUnit[]): number {
  return units.some((unit) => unit.splitLevel === 'fallback')
    ? OVERLAP_FALLBACK
    : OVERLAP_STRUCTURED;
}

function takeOverlapUnits(units: TextUnit[], overlapTokens: number): TextUnit[] {
  const overlap: TextUnit[] = [];
  let tokens = 0;

  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];
    if (!unit) {
      continue;
    }
    overlap.unshift(unit);
    tokens += unit.tokenCount;
    if (tokens >= overlapTokens) {
      break;
    }
  }

  return overlap;
}

function buildChunkFromUnits(
  units: TextUnit[],
  metadados: ChunkSourceMetadata,
  encoding: Tiktoken,
): Chunk {
  const conteudo = units.map((unit) => unit.text).join('\n\n');
  const posicaoInicio = units[0]?.start ?? 0;
  const posicaoFim = units[units.length - 1]?.end ?? posicaoInicio;
  const tokens = countTokens(conteudo, encoding);

  return {
    conteudo,
    tokens,
    posicao_inicio: posicaoInicio,
    posicao_fim: posicaoFim,
    metadados: {
      ...metadados,
      posicao_inicio: posicaoInicio,
      posicao_fim: posicaoFim,
    },
  };
}

function hardSplitOversizedChunk(
  chunk: Chunk,
  encoding: Tiktoken,
  overlapTokens: number,
): Chunk[] {
  const tokenIds = encoding.encode(chunk.conteudo);
  if (tokenIds.length <= CHUNK_MAX_TOKENS) {
    return [chunk];
  }

  const results: Chunk[] = [];
  let tokenStart = 0;

  while (tokenStart < tokenIds.length) {
    const tokenEnd = Math.min(tokenStart + CHUNK_MAX_TOKENS, tokenIds.length);
    const sliceTokens = tokenIds.slice(tokenStart, tokenEnd);
    const conteudo = encoding.decode(sliceTokens);
    const localStart = tokenStart === 0
      ? 0
      : encoding.decode(tokenIds.slice(0, tokenStart)).length;
    const posicaoInicio = chunk.posicao_inicio + localStart;
    const posicaoFim = posicaoInicio + conteudo.length;

    results.push({
      conteudo,
      tokens: sliceTokens.length,
      posicao_inicio: posicaoInicio,
      posicao_fim: posicaoFim,
      metadados: {
        ...chunk.metadados,
        posicao_inicio: posicaoInicio,
        posicao_fim: posicaoFim,
      },
    });

    if (tokenEnd >= tokenIds.length) {
      break;
    }

    tokenStart = Math.max(tokenStart + 1, tokenEnd - overlapTokens);
  }

  return results;
}

function enforceMaxTokenLimit(chunks: Chunk[], encoding: Tiktoken): Chunk[] {
  const validated: Chunk[] = [];

  for (const chunk of chunks) {
    const actualTokens = countTokens(chunk.conteudo, encoding);
    const normalized: Chunk = actualTokens === chunk.tokens
      ? chunk
      : { ...chunk, tokens: actualTokens };

    if (normalized.tokens <= CHUNK_MAX_TOKENS) {
      validated.push(normalized);
      continue;
    }

    validated.push(
      ...hardSplitOversizedChunk(normalized, encoding, OVERLAP_FALLBACK),
    );
  }

  const final: Chunk[] = [];

  for (const chunk of validated) {
    const tokens = countTokens(chunk.conteudo, encoding);
    if (tokens <= CHUNK_MAX_TOKENS) {
      final.push({ ...chunk, tokens });
      continue;
    }

    final.push(
      ...hardSplitOversizedChunk(
        { ...chunk, tokens },
        encoding,
        OVERLAP_FALLBACK,
      ),
    );
  }

  return final;
}

function discardDegenerateChunks(chunks: Chunk[], encoding: Tiktoken): Chunk[] {
  return chunks.filter((chunk) => {
    const tokens = countTokens(chunk.conteudo, encoding);
    return tokens >= MIN_USEFUL_TOKENS;
  }).map((chunk) => ({
    ...chunk,
    tokens: countTokens(chunk.conteudo, encoding),
  }));
}

export function chunkText(input: ChunkingInput): Chunk[] {
  const texto = input.texto.trim();
  if (!texto) {
    return [];
  }

  const encoding = getChunkEncoding();
  const units = collectSemanticUnits(texto, encoding);

  if (units.length === 0) {
    const singleChunk: Chunk = {
      conteudo: texto,
      tokens: countTokens(texto, encoding),
      posicao_inicio: 0,
      posicao_fim: texto.length,
      metadados: {
        ...input.metadados,
        posicao_inicio: 0,
        posicao_fim: texto.length,
      },
    };

    return discardDegenerateChunks(
      enforceMaxTokenLimit([singleChunk], encoding),
      encoding,
    );
  }

  const rawChunks: Chunk[] = [];
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

    rawChunks.push(buildChunkFromUnits(buffer, input.metadados, encoding));
    buffer = takeOverlapUnits(buffer, resolveOverlapForBuffer(buffer));
  }

  if (buffer.length > 0) {
    rawChunks.push(buildChunkFromUnits(buffer, input.metadados, encoding));
  }

  return discardDegenerateChunks(
    enforceMaxTokenLimit(rawChunks, encoding),
    encoding,
  );
}

export function chunkTextSimple(
  texto: string,
  metadados: ChunkSourceMetadata,
): Chunk[] {
  return chunkText({ texto, metadados });
}

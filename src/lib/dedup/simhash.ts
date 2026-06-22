import { createHash } from 'node:crypto';

const SIMHASH_BITS = 64;

/** Similaridade mínima para alerta (RF-007): estritamente > 80%. */
export const SIMHASH_SIMILARITY_THRESHOLD = 0.8;

function tokenize(text: string): string[] {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function hashTokenToBigInt(token: string): bigint {
  const digest = createHash('sha256').update(token).digest();
  let value = 0n;

  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) | BigInt(digest[index] ?? 0);
  }

  return value;
}

export function computeSimhash(text: string): string {
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return '0'.repeat(16);
  }

  const weights = new Array<number>(SIMHASH_BITS).fill(0);

  for (const token of tokens) {
    const hash = hashTokenToBigInt(token);

    for (let bit = 0; bit < SIMHASH_BITS; bit += 1) {
      const mask = 1n << BigInt(bit);
      weights[bit] = (weights[bit] ?? 0) + ((hash & mask) !== 0n ? 1 : -1);
    }
  }

  let simhash = 0n;

  for (let bit = 0; bit < SIMHASH_BITS; bit += 1) {
    if ((weights[bit] ?? 0) > 0) {
      simhash |= 1n << BigInt(bit);
    }
  }

  return simhash.toString(16).padStart(16, '0');
}

export function simhashToBigInt(hex: string): bigint {
  const normalized = hex.trim().padStart(16, '0');
  return BigInt(`0x${normalized}`);
}

export function hammingDistance(hexA: string, hexB: string): number {
  let xor = simhashToBigInt(hexA) ^ simhashToBigInt(hexB);
  let distance = 0;

  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance;
}

export function simhashSimilarity(hexA: string, hexB: string): number {
  const distance = hammingDistance(hexA, hexB);
  return (SIMHASH_BITS - distance) / SIMHASH_BITS;
}

export function isSimilarSimhash(hexA: string, hexB: string): boolean {
  return simhashSimilarity(hexA, hexB) > SIMHASH_SIMILARITY_THRESHOLD;
}

export function readStoredSimhash(
  metadados: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadados) {
    return null;
  }

  const value = metadados.simhash;

  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  return value;
}

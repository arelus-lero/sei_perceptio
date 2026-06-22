export function parsePgVector(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'number')
      ? (value as number[])
      : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }

  const parts = trimmed.slice(1, -1).split(',');
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return null;
  }

  const numbers = parts.map((part) => Number.parseFloat(part.trim()));
  if (numbers.some((item) => Number.isNaN(item))) {
    return null;
  }

  return numbers;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let normLeft = 0;
  let normRight = 0;

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    dot += a * b;
    normLeft += a * a;
    normRight += b * b;
  }

  if (normLeft === 0 || normRight === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normLeft) * Math.sqrt(normRight));
}

export function meanEmbedding(vectors: number[][]): number[] | null {
  if (vectors.length === 0) {
    return null;
  }

  const dimensions = vectors[0]!.length;
  const mean = new Array<number>(dimensions).fill(0);

  for (const vector of vectors) {
    if (vector.length !== dimensions) {
      continue;
    }
    for (let index = 0; index < dimensions; index += 1) {
      mean[index]! += vector[index]!;
    }
  }

  for (let index = 0; index < dimensions; index += 1) {
    mean[index]! /= vectors.length;
  }

  return mean;
}

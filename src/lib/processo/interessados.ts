export function extractInteressadoKeys(
  interessados: Record<string, unknown>[],
): Set<string> {
  const keys = new Set<string>();

  for (const item of interessados) {
    const nome =
      typeof item.nome === 'string' ? item.nome.trim().toLowerCase() : null;
    const cpf =
      typeof item.cpf === 'string' ? item.cpf.replace(/\D/g, '') : null;
    const cnpj =
      typeof item.cnpj === 'string' ? item.cnpj.replace(/\D/g, '') : null;

    if (cpf && cpf.length >= 11) {
      keys.add(`cpf:${cpf}`);
    }
    if (cnpj && cnpj.length >= 14) {
      keys.add(`cnpj:${cnpj}`);
    }
    if (nome && nome.length > 3) {
      keys.add(`nome:${nome}`);
    }
  }

  return keys;
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 && right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const key of left) {
    if (right.has(key)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function countInteressadosComuns(
  left: Set<string>,
  right: Set<string>,
): number {
  let count = 0;
  for (const key of left) {
    if (right.has(key)) {
      count += 1;
    }
  }
  return count;
}

function longestCommonSubsequence(left: string[], right: string[]): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  return dp[rows - 1]![cols - 1]!;
}

export function fluxoSimilarity(
  referencia: string[],
  candidato: string[],
): number {
  if (referencia.length === 0 && candidato.length === 0) {
    return 0;
  }

  const setReferencia = new Set(referencia);
  const setCandidato = new Set(candidato);
  let intersection = 0;

  for (const unidade of setReferencia) {
    if (setCandidato.has(unidade)) {
      intersection += 1;
    }
  }

  const union = new Set([...referencia, ...candidato]).size;
  const jaccardUnidades = union > 0 ? intersection / union : 0;

  const lcs = longestCommonSubsequence(referencia, candidato);
  const denominador = referencia.length + candidato.length;
  const sequencia =
    denominador > 0 ? (2 * lcs) / denominador : 0;

  return Math.min(1, 0.45 * jaccardUnidades + 0.55 * sequencia);
}

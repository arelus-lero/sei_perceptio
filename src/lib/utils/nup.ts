export const NUP_PREFIXO_ANEEL = '48500';
export const NUP_REGEX = /^(\d{5})\.(\d{6})\/(\d{4})-(\d{2})$/;

/** Portaria Interministerial nº 11/2019 — resto mod 11 → DV (despreza dezena se 11−resto ≥ 10). */
function remainderMod11ToDv(sum: number): number {
  return (11 - (sum % 11)) % 10;
}

/** Pesos da direita para a esquerda: startWeight … startWeight + length − 1. */
function sumWeightedRightToLeft(value: string, startWeight: number): number {
  let sum = 0;
  for (let index = 0; index < value.length; index += 1) {
    const digit = Number.parseInt(value[value.length - 1 - index]!, 10);
    sum += digit * (startWeight + index);
  }
  return sum;
}

export function calcularDvNup(base15: string): string {
  if (!/^\d{15}$/.test(base15)) {
    throw new Error(`Base NUP inválida (esperado 15 dígitos): ${base15}`);
  }

  const dv1 = remainderMod11ToDv(sumWeightedRightToLeft(base15, 2));
  const base16 = `${base15}${dv1}`;
  const dv2 = remainderMod11ToDv(sumWeightedRightToLeft(base16, 2));

  return `${dv1}${dv2}`;
}

export function formatarNup(base15: string, dv: string): string {
  const codigo = base15.slice(0, 5);
  const sequencial = base15.slice(5, 11);
  const ano = base15.slice(11, 15);
  return `${codigo}.${sequencial}/${ano}-${dv}`;
}

export function gerarNup(sequencial: number, ano: number, prefixo = NUP_PREFIXO_ANEEL): string {
  const seq = sequencial.toString().padStart(6, '0');
  const anoStr = ano.toString().padStart(4, '0');
  const base15 = `${prefixo}${seq}${anoStr}`;
  const dv = calcularDvNup(base15);
  return formatarNup(base15, dv);
}

export function validarNup(nup: string): boolean {
  if (!NUP_REGEX.test(nup)) {
    return false;
  }

  const match = nup.match(NUP_REGEX);
  if (!match) {
    return false;
  }

  const [, prefixo, sequencial, ano, dvInformado] = match;
  const base15 = `${prefixo}${sequencial}${ano}`;
  const dvCalculado = calcularDvNup(base15);
  return dvCalculado === dvInformado;
}

export function extrairResultadoDeliberativo(conteudo: string): string | null {
  const match = conteudo.match(
    /A Diretoria Colegiada decidiu, por (unanimidade|maioria), ([^.]+(?:\.[^.]+)*)/i,
  );
  if (!match) {
    return null;
  }
  return `A Diretoria Colegiada decidiu, por ${match[1]}, ${match[2]?.trim() ?? ''}`.trim();
}

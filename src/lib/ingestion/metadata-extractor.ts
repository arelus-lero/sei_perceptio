import { NUP_REGEX } from '@/lib/utils/nup';
import {
  SIGILO_TEXT_PATTERNS,
  TIPO_PROCESSO_CODIGO_PATTERN,
  UNIDADE_GERADORA_PATTERN,
} from '@/lib/ingestion/anonymization/patterns';
import { SIGILO_TIPO_PROCESSO_CODIGO, type SeiExtractedMetadata } from '@/types/anonymization';

export function extractSeiMetadata(texto: string): SeiExtractedMetadata {
  const nupMatch = texto.match(NUP_REGEX);
  const tipoMatch = texto.match(TIPO_PROCESSO_CODIGO_PATTERN);
  const unidadeMatch = texto.match(UNIDADE_GERADORA_PATTERN);

  const tipoCodigo = tipoMatch?.[1] ?? null;
  const sigiloPorTexto = SIGILO_TEXT_PATTERNS.some((pattern) => pattern.test(texto));
  const sigiloPorCodigo = tipoCodigo === SIGILO_TIPO_PROCESSO_CODIGO;

  return {
    nup: nupMatch?.[0] ?? null,
    tipo_processo_codigo: tipoCodigo,
    unidade_geradora: unidadeMatch?.[1] ?? null,
    sigiloso_detectado: sigiloPorTexto || sigiloPorCodigo,
  };
}

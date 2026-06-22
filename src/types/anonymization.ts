export type AnonymizationMode = 'mask' | 'redact' | 'remove';

export type PiiType =
  | 'CPF'
  | 'CNPJ'
  | 'EMAIL'
  | 'TELEFONE'
  | 'ENDERECO'
  | 'DADOS_BANCARIOS'
  | 'DADOS_SENSIVEIS';

export interface DetectedEntity {
  type: PiiType;
  start: number;
  end: number;
  score: number;
  source: 'regex' | 'presidio' | 'spacy';
  original: string;
}

export interface AnonymizationStats {
  total: number;
  by_type: Partial<Record<PiiType, number>>;
}

export interface AnonymizationResult {
  texto_original_length: number;
  texto_anonimizado: string;
  mode: AnonymizationMode;
  entities: DetectedEntity[];
  stats: AnonymizationStats;
  anonymized: boolean;
  engine: 'regex' | 'presidio' | 'spacy' | 'hybrid';
}

export interface AnonymizeTextParams {
  texto: string;
  mode?: AnonymizationMode;
  piiTypes?: PiiType[];
}

export interface SeiExtractedMetadata {
  nup: string | null;
  tipo_processo_codigo: string | null;
  unidade_geradora: string | null;
  sigiloso_detectado: boolean;
}

export interface SigiloCheckResult {
  blocked: boolean;
  reason?: string;
  tipo_processo_codigo?: string;
  exception_applied: boolean;
}

export const ALL_PII_TYPES: PiiType[] = [
  'CPF',
  'CNPJ',
  'EMAIL',
  'TELEFONE',
  'ENDERECO',
  'DADOS_BANCARIOS',
  'DADOS_SENSIVEIS',
];

export const SIGILO_TIPO_PROCESSO_CODIGO = '100001101';

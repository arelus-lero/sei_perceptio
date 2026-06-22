import type { PiiType } from '@/types/anonymization';

export interface PiiPattern {
  type: PiiType;
  pattern: RegExp;
  score: number;
}

export const PII_PATTERNS: PiiPattern[] = [
  {
    type: 'CPF',
    pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
    score: 0.95,
  },
  {
    type: 'CNPJ',
    pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,
    score: 0.95,
  },
  {
    type: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
    score: 0.98,
  },
  {
    type: 'TELEFONE',
    pattern:
      /(?:\+55\s*)?(?:\(?\d{2}\)?[\s.-]?)?(?:9[\s.-]?)?\d{4}[\s.-]?\d{4}\b/g,
    score: 0.9,
  },
  {
    type: 'DADOS_BANCARIOS',
    pattern:
      /\b(?:ag[eê]ncia|ag\.?|conta\s*corrente|c\/c|conta|pix|ispb|banco)\s*[:\s#-]*\d[\d\s./-]{3,24}\b/gi,
    score: 0.88,
  },
  {
    type: 'DADOS_BANCARIOS',
    pattern: /\b\d{4,5}[\s-]\d{1,2}[\s-]\d{5,12}[\s-]\d{1}\b/g,
    score: 0.85,
  },
  {
    type: 'ENDERECO',
    pattern:
      /\b(?:Rua|Av\.?|Avenida|Travessa|Alameda|Rodovia|BR-\d{2,3})\s+[A-Za-zÀ-ú0-9\s.,ºª/-]{5,80}\b/gi,
    score: 0.82,
  },
  {
    type: 'ENDERECO',
    pattern: /\bCEP\s*[:\s]?\d{5}-?\d{3}\b/gi,
    score: 0.9,
  },
  {
    type: 'DADOS_SENSIVEIS',
    pattern:
      /\b(?:diagn[oó]stico|CID[-\s]?\d{2,3}|biometria|filia[cç][aã]o\s+pol[ií]tica|orienta[cç][aã]o\s+sexual|dado\s+sens[ií]vel|sa[uú]de\s+mental)\b[^.\n]{0,120}/gi,
    score: 0.8,
  },
];

export const SIGILO_TEXT_PATTERNS = [
  /\b100001101\b/,
  /processo\s+sigiloso/i,
  /tipo\s+de\s+processo\s*[:\s-]*100001101/i,
  /classifica[cç][aã]o\s*[:\s-]*sigilos[oa]/i,
];

export const TIPO_PROCESSO_CODIGO_PATTERN =
  /tipo\s+de\s+processo\s*[:\s-]*(\d{9})/i;

export const UNIDADE_GERADORA_PATTERN =
  /unidade\s+geradora\s*[:\s-]*([A-Z]{2,6})/i;

const PRESIDIO_ENTITY_MAP: Record<string, PiiType> = {
  BR_CPF: 'CPF',
  BR_CNPJ: 'CNPJ',
  EMAIL_ADDRESS: 'EMAIL',
  PHONE_NUMBER: 'TELEFONE',
  LOCATION: 'ENDERECO',
  IBAN_CODE: 'DADOS_BANCARIOS',
  CREDIT_CARD: 'DADOS_BANCARIOS',
  MEDICAL_LICENSE: 'DADOS_SENSIVEIS',
  NRP: 'DADOS_SENSIVEIS',
};

const SPACY_LABEL_MAP: Record<string, PiiType> = {
  PER: 'DADOS_SENSIVEIS',
  LOC: 'ENDERECO',
  GPE: 'ENDERECO',
  ORG: 'CNPJ',
};

export function mapPresidioEntity(entityType: string): PiiType | null {
  return PRESIDIO_ENTITY_MAP[entityType] ?? null;
}

export function mapSpacyLabel(label: string): PiiType | null {
  return SPACY_LABEL_MAP[label] ?? null;
}

export { PRESIDIO_ENTITY_MAP, SPACY_LABEL_MAP };

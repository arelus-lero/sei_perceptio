import type { DuplicateFonteMatch, SimilarFonteMatch } from '@/types/dedup';

export class DuplicateChecksumError extends Error {
  readonly code = 'DUPLICATE_CHECKSUM' as const;
  readonly httpStatus = 409;
  readonly duplicates: DuplicateFonteMatch[];

  constructor(duplicates: DuplicateFonteMatch[]) {
    super(
      duplicates.length === 1
        ? 'Arquivo idêntico (checksum SHA-256) já existe neste órgão.'
        : `${duplicates.length} fontes com o mesmo checksum SHA-256 já existem neste órgão.`,
    );
    this.name = 'DuplicateChecksumError';
    this.duplicates = duplicates;
  }
}

export class SimilarContentError extends Error {
  readonly code = 'SIMILAR_CONTENT' as const;
  readonly httpStatus = 409;
  readonly blocking = false;
  readonly matches: SimilarFonteMatch[];

  constructor(matches: SimilarFonteMatch[]) {
    super(
      matches.length === 1
        ? 'Conteúdo com sobreposição superior a 80% detectado em outra fonte.'
        : `Conteúdo similar detectado em ${matches.length} fontes existentes.`,
    );
    this.name = 'SimilarContentError';
    this.matches = matches;
  }
}

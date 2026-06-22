export interface DuplicateFonteMatch {
  fonte_id: string;
  titulo: string;
  notebook_id: string;
  checksum: string;
}

export interface SimilarFonteMatch {
  fonte_id: string;
  titulo: string;
  notebook_id: string;
  similarity: number;
  checksum: string | null;
}

export interface UploadDedupResult {
  checksum_checked: boolean;
  checksum_duplicate: boolean;
  similar_matches: SimilarFonteMatch[];
}

export type UploadDedupAlertKind = 'checksum' | 'similar';

export interface UploadDedupAlertPayload {
  kind: UploadDedupAlertKind;
  message: string;
  duplicates?: DuplicateFonteMatch[];
  matches?: SimilarFonteMatch[];
}

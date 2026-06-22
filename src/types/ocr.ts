export type OcrEngine = 'tesseract.js';

export type TextExtractionMethod =
  | 'plain'
  | 'pdf_native'
  | 'pdf_ocr'
  | 'html'
  | 'unsupported';

export interface OcrPageResult {
  page: number;
  text: string;
  confidence: number;
}

export interface OcrResult {
  text: string;
  language: string;
  engine: OcrEngine;
  page_count: number;
  pages: OcrPageResult[];
  average_confidence: number;
}

export interface DocumentTextExtractionResult {
  text: string | null;
  method: TextExtractionMethod;
  ocr_applied: boolean;
  requires_ocr?: boolean;
  page_count: number | null;
  ocr_confidence: number | null;
  encoding?: string;
}

export interface ExtractDocumentTextOptions {
  forceOcr?: boolean;
  maxPages?: number;
  /** Concorrência do pool Tesseract (RNF-002). */
  ocrConcurrency?: number;
  /** When true, scanned PDFs are flagged instead of running OCR inline. */
  deferOcr?: boolean;
}

export interface RecognizePdfPageImagesOptions {
  concurrency?: number;
}

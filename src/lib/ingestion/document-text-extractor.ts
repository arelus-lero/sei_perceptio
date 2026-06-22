import { getFileExtension } from '@/lib/ingestion/file-type';
import { extractHtmlText } from '@/lib/ingestion/html-text';
import { recognizePdfPageImages } from '@/lib/ingestion/ocr';
import {
  extractPdfNativeText,
  getDefaultMaxOcrPages,
  renderPdfPagesToPng,
} from '@/lib/ingestion/pdf-text';
import type {
  DocumentTextExtractionResult,
  ExtractDocumentTextOptions,
} from '@/types/ocr';

const PLAIN_TEXT_EXTENSIONS = new Set(['txt', 'md']);

function normalizePlainText(text: string): string {
  return text.replace(/\r\n/g, '\n').trim();
}

async function extractPlainText(buffer: Buffer): Promise<DocumentTextExtractionResult> {
  const text = normalizePlainText(buffer.toString('utf-8'));
  return {
    text: text.length > 0 ? text : null,
    method: 'plain',
    ocr_applied: false,
    requires_ocr: false,
    page_count: null,
    ocr_confidence: null,
  };
}

async function extractPdfText(
  buffer: Buffer,
  options: ExtractDocumentTextOptions,
): Promise<DocumentTextExtractionResult> {
  const native = await extractPdfNativeText(buffer);

  if (native.has_text_layer) {
    return {
      text: native.text,
      method: 'pdf_native',
      ocr_applied: false,
      requires_ocr: false,
      page_count: native.page_count,
      ocr_confidence: null,
    };
  }

  if (options.deferOcr && !options.forceOcr) {
    return {
      text: native.text.length > 0 ? native.text : null,
      method: 'pdf_native',
      ocr_applied: false,
      requires_ocr: true,
      page_count: native.page_count,
      ocr_confidence: null,
    };
  }

  const maxPages = options.maxPages ?? getDefaultMaxOcrPages();
  const pageImages = await renderPdfPagesToPng(buffer, maxPages);
  if (pageImages.length === 0) {
    return {
      text: native.text.length > 0 ? native.text : null,
      method: native.text.length > 0 ? 'pdf_native' : 'pdf_native',
      ocr_applied: false,
      requires_ocr: native.text.length === 0,
      page_count: native.page_count,
      ocr_confidence: null,
    };
  }

  const ocrResult = await recognizePdfPageImages(pageImages, {
    concurrency: options.ocrConcurrency,
  });
  const text = ocrResult.text.trim();

  return {
    text: text.length > 0 ? text : null,
    method: 'pdf_ocr',
    ocr_applied: true,
    requires_ocr: text.length === 0,
    page_count: ocrResult.page_count,
    ocr_confidence: ocrResult.average_confidence,
  };
}

export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  options: ExtractDocumentTextOptions = {},
): Promise<DocumentTextExtractionResult> {
  const extension = getFileExtension(filename);

  if (PLAIN_TEXT_EXTENSIONS.has(extension)) {
    return extractPlainText(buffer);
  }

  if (extension === 'pdf') {
    return extractPdfText(buffer, options);
  }

  if (extension === 'html' || extension === 'htm') {
    return extractHtmlText(buffer);
  }

  return {
    text: null,
    method: 'unsupported',
    ocr_applied: false,
    requires_ocr: false,
    page_count: null,
    ocr_confidence: null,
  };
}

export async function extractDocumentTextByType(
  buffer: Buffer,
  fileType: string,
  originalFilename: string,
  options: ExtractDocumentTextOptions = {},
): Promise<DocumentTextExtractionResult> {
  const normalizedType = fileType === 'htm' ? 'html' : fileType;

  if (normalizedType === 'html') {
    return extractHtmlText(buffer);
  }

  return extractDocumentText(buffer, originalFilename, options);
}

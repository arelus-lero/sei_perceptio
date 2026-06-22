import type { OcrPageResult, OcrResult, RecognizePdfPageImagesOptions } from '@/types/ocr';

const TAB_GAP_THRESHOLD_PX = 24;
const OCR_LANGUAGE = process.env.OCR_LANGUAGE ?? 'por';
const DEFAULT_OCR_CONCURRENCY = 4;
const MAX_OCR_CONCURRENCY = 16;

interface BboxWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface TesseractRecognizeData {
  text: string;
  confidence: number;
  lines?: Array<{
    text: string;
    confidence: number;
    words?: BboxWord[];
  }>;
  words?: BboxWord[];
}

type OcrWorker = {
  setParameters: (params: Record<string, string | number>) => Promise<unknown>;
  recognize: (
    image: Buffer | Uint8Array,
    options?: Record<string, unknown>,
    output?: Record<string, unknown>,
  ) => Promise<{ data: TesseractRecognizeData }>;
  terminate: () => Promise<void>;
};

export function getOcrConcurrency(requested?: number): number {
  if (requested !== undefined && Number.isFinite(requested) && requested > 0) {
    return Math.min(Math.floor(requested), MAX_OCR_CONCURRENCY);
  }

  const raw = process.env.OCR_CONCURRENCY;
  if (!raw) {
    return DEFAULT_OCR_CONCURRENCY;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_OCR_CONCURRENCY;
  }

  return Math.min(parsed, MAX_OCR_CONCURRENCY);
}

async function createOcrWorker(): Promise<OcrWorker> {
  const { createWorker } = await import('tesseract.js');
  const worker = (await createWorker(OCR_LANGUAGE)) as unknown as OcrWorker;

  await worker.setParameters({
    tessedit_pageseg_mode: '3',
    preserve_interword_spaces: '1',
  });

  return worker;
}

function formatLineWithTabulation(words: BboxWord[]): string {
  if (words.length === 0) {
    return '';
  }

  const sorted = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const parts: string[] = [sorted[0]?.text ?? ''];

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!previous || !current) {
      continue;
    }

    const gap = current.bbox.x0 - previous.bbox.x1;
    const separator = gap >= TAB_GAP_THRESHOLD_PX ? '\t' : ' ';
    parts.push(`${separator}${current.text}`);
  }

  return parts.join('');
}

function formatRecognizedText(data: TesseractRecognizeData): string {
  if (data.lines && data.lines.length > 0) {
    const lines = data.lines.map((line) => {
      if (line.words && line.words.length > 0) {
        return formatLineWithTabulation(line.words);
      }
      return line.text.trim();
    });

    return lines.filter((line) => line.length > 0).join('\n');
  }

  if (data.words && data.words.length > 0) {
    const lineMap = new Map<number, BboxWord[]>();

    for (const word of data.words) {
      const lineKey = Math.round(word.bbox.y0 / 10);
      const bucket = lineMap.get(lineKey) ?? [];
      bucket.push(word);
      lineMap.set(lineKey, bucket);
    }

    return [...lineMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, words]) => formatLineWithTabulation(words))
      .filter((line) => line.length > 0)
      .join('\n');
  }

  return data.text.trim();
}

async function recognizePageWithWorker(
  worker: OcrWorker,
  image: Buffer,
  pageNumber: number,
): Promise<OcrPageResult> {
  const { data } = await worker.recognize(image, {}, { text: true, blocks: true });

  return {
    page: pageNumber,
    text: formatRecognizedText(data),
    confidence: data.confidence,
  };
}

function assembleOcrResult(pages: OcrPageResult[]): OcrResult {
  const averageConfidence =
    pages.length > 0
      ? pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length
      : 0;

  const text = pages
    .map((page) => page.text.trim())
    .filter((pageText) => pageText.length > 0)
    .join('\n\n');

  return {
    text,
    language: OCR_LANGUAGE,
    engine: 'tesseract.js',
    page_count: pages.length,
    pages,
    average_confidence: averageConfidence,
  };
}

/**
 * RNF-002: OCR paralelo com pool de workers Tesseract (ordem de páginas preservada).
 */
async function recognizePdfPageImagesParallel(
  images: Buffer[],
  concurrency: number,
): Promise<OcrResult> {
  const pages: OcrPageResult[] = new Array(images.length);
  let nextIndex = 0;

  async function runPoolWorker(): Promise<void> {
    const worker = await createOcrWorker();

    try {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= images.length) {
          break;
        }

        const image = images[index];
        if (!image) {
          continue;
        }

        pages[index] = await recognizePageWithWorker(worker, image, index + 1);
      }
    } finally {
      await worker.terminate();
    }
  }

  const poolSize = Math.min(concurrency, images.length);
  await Promise.all(Array.from({ length: poolSize }, () => runPoolWorker()));

  const orderedPages = pages.filter(
    (page): page is OcrPageResult => page !== undefined,
  );

  orderedPages.sort((left, right) => left.page - right.page);

  return assembleOcrResult(orderedPages);
}

export async function recognizeImageBuffer(image: Buffer): Promise<OcrPageResult> {
  const worker = await createOcrWorker();

  try {
    return await recognizePageWithWorker(worker, image, 1);
  } finally {
    await worker.terminate();
  }
}

export async function recognizePdfPageImages(
  images: Buffer[],
  options: RecognizePdfPageImagesOptions = {},
): Promise<OcrResult> {
  if (images.length === 0) {
    return assembleOcrResult([]);
  }

  const concurrency = getOcrConcurrency(options.concurrency);
  return recognizePdfPageImagesParallel(images, concurrency);
}

/** @deprecated Pool encerra workers por tarefa; noop para compatibilidade. */
export async function terminateOcrWorker(): Promise<void> {
  return Promise.resolve();
}

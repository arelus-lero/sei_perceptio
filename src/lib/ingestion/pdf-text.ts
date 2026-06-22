const DEFAULT_MIN_CHARS_PER_PAGE = 30;

function getMinCharsPerPage(): number {
  const raw = process.env.OCR_MIN_CHARS_PER_PAGE;
  if (!raw) {
    return DEFAULT_MIN_CHARS_PER_PAGE;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MIN_CHARS_PER_PAGE;
}

export interface PdfNativeTextResult {
  text: string;
  page_count: number;
  chars_per_page: number;
  has_text_layer: boolean;
}

export async function extractPdfNativeText(buffer: Buffer): Promise<PdfNativeTextResult> {
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = pdfParseModule.default ?? pdfParseModule;

  const parsed = (await pdfParse(buffer)) as {
    text: string;
    numpages: number;
  };

  const text = parsed.text.replace(/\r\n/g, '\n').trim();
  const pageCount = Math.max(parsed.numpages, 1);
  const charsPerPage = text.length / pageCount;
  const minChars = getMinCharsPerPage();

  return {
    text,
    page_count: pageCount,
    chars_per_page: charsPerPage,
    has_text_layer: text.length > 0 && charsPerPage >= minChars,
  };
}

export async function renderPdfPagesToPng(
  buffer: Buffer,
  maxPages: number,
): Promise<Buffer[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');

  const scale = Number.parseFloat(process.env.OCR_PDF_RENDER_SCALE ?? '2');
  const renderScale = Number.isFinite(scale) && scale > 0 ? scale : 2;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdfDocument = await loadingTask.promise;
  const pageLimit = Math.min(pdfDocument.numPages, maxPages);
  const images: Buffer[] = [];

  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: renderScale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    const renderTask = page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    });

    await renderTask.promise;
    images.push(canvas.toBuffer('image/png'));
    page.cleanup();
  }

  await pdfDocument.destroy();
  return images;
}

export function getDefaultMaxOcrPages(): number {
  const raw = process.env.OCR_MAX_PAGES;
  if (!raw) {
    return 100;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

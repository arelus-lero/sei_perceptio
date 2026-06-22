export const SUPPORTED_UPLOAD_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'txt',
  'md',
  'html',
  'htm',
  'xlsx',
  'pptx',
  'jpg',
  'jpeg',
  'png',
  'tiff',
  'tif',
  'mp3',
  'wav',
]);

const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/tiff': 'tiff',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

export function getFileExtension(filename: string): string {
  const trimmed = filename.trim();
  const lastDot = trimmed.lastIndexOf('.');

  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return '';
  }

  return trimmed.slice(lastDot + 1).toLowerCase();
}

export function resolveUploadFileType(filename: string, mimeType: string): string | null {
  const extension = getFileExtension(filename);

  if (extension && SUPPORTED_UPLOAD_EXTENSIONS.has(extension)) {
    return extension === 'htm' ? 'html' : extension;
  }

  const normalizedMime = mimeType.trim().toLowerCase();
  if (normalizedMime && MIME_TO_EXTENSION[normalizedMime]) {
    return MIME_TO_EXTENSION[normalizedMime];
  }

  if (
    normalizedMime === 'application/octet-stream'
    && extension
    && SUPPORTED_UPLOAD_EXTENSIONS.has(extension)
  ) {
    return extension === 'htm' ? 'html' : extension;
  }

  return null;
}

export function isTextExtractableType(fileType: string): boolean {
  return ['pdf', 'docx', 'txt', 'md', 'html'].includes(fileType);
}

export function formatUnsupportedTypeMessage(filename: string, mimeType: string): string {
  const extension = getFileExtension(filename);
  const mimeHint = mimeType ? ` (tipo informado: ${mimeType})` : '';
  const extHint = extension ? `.${extension}` : 'sem extensão reconhecida';

  return `Formato de arquivo não suportado: ${extHint}${mimeHint}. Tipos aceitos: PDF, HTML, DOCX, TXT, MD e demais formatos já configurados.`;
}

const URL_SUPPORTED_FILE_TYPES = new Set(['pdf', 'html', 'txt', 'md']);

export function resolveUrlFileType(filename: string, mimeType: string): string | null {
  const fileType = resolveUploadFileType(filename, mimeType);

  if (!fileType || !URL_SUPPORTED_FILE_TYPES.has(fileType)) {
    return null;
  }

  return fileType;
}

export function formatUnsupportedUrlTypeMessage(filename: string, mimeType: string): string {
  const extension = getFileExtension(filename);
  const mimeHint = mimeType ? ` (Content-Type: ${mimeType})` : '';
  const extHint = extension ? `.${extension}` : 'tipo não reconhecido';

  return `Conteúdo da URL não suportado: ${extHint}${mimeHint}. URLs públicas aceitam HTML, PDF, TXT e Markdown.`;
}

export function defaultFilenameForUrlFileType(fileType: string): string {
  switch (fileType) {
    case 'pdf':
      return 'documento.pdf';
    case 'txt':
      return 'documento.txt';
    case 'md':
      return 'documento.md';
    default:
      return 'pagina.html';
  }
}

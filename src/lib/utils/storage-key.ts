import { randomUUID } from 'node:crypto';

const STORAGE_KEY_PATTERN = /^[a-zA-Z0-9/._-]+$/;

export function splitFileName(filename: string): { baseName: string; extension: string } {
  const trimmed = filename.trim();
  const lastDot = trimmed.lastIndexOf('.');

  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { baseName: trimmed, extension: '' };
  }

  return {
    baseName: trimmed.slice(0, lastDot),
    extension: trimmed.slice(lastDot + 1),
  };
}

export function sanitizeStorageBaseName(baseName: string): string {
  const semAcento = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const safe = semAcento
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 80);

  return safe || 'file';
}

export function sanitizeFileExtension(extension: string): string {
  const semAcento = extension.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const safe = semAcento.toLowerCase().replace(/[^a-z0-9]/g, '');

  return safe || 'bin';
}

export function sanitizeStorageFileSegment(originalFilename: string): string {
  const { baseName, extension } = splitFileName(originalFilename);
  const safeBase = sanitizeStorageBaseName(baseName);
  const safeExt = extension ? sanitizeFileExtension(extension) : 'bin';

  return `${safeBase}.${safeExt}`;
}

export function buildDocumentStorageKey(
  orgaoId: string,
  notebookId: string,
  originalFilename: string,
  objectId: string = randomUUID(),
): string {
  const safeSegment = sanitizeStorageFileSegment(originalFilename);
  const key = `${orgaoId}/${notebookId}/${objectId}-${safeSegment}`;

  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new Error(`Invalid storage key generated: ${key}`);
  }

  return key;
}

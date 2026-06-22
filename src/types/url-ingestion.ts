export const URL_FETCH_TIMEOUT_MS = 30_000;
export const URL_MAX_BYTES = 25 * 1024 * 1024;
export const URL_MAX_REDIRECTS = 5;

export const URL_SUPPORTED_MIME_TYPES = new Set([
  'text/html',
  'application/xhtml+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
]);

export type UrlFetchErrorCode =
  | 'INVALID_URL'
  | 'PRIVATE_HOST'
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'UNSUPPORTED_TYPE'
  | 'SIZE_LIMIT'
  | 'EMPTY_CONTENT'
  | 'HTTP_ERROR';

export interface FetchedUrlContent {
  buffer: Buffer;
  contentType: string;
  fileType: string;
  filename: string;
  finalUrl: string;
  sizeBytes: number;
}

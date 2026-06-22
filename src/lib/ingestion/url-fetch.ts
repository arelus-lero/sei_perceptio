import 'server-only';

import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';

import {
  defaultFilenameForUrlFileType,
  formatUnsupportedUrlTypeMessage,
  getFileExtension,
  resolveUrlFileType,
} from '@/lib/ingestion/file-type';
import type {
  FetchedUrlContent,
  UrlFetchErrorCode,
} from '@/types/url-ingestion';
import {
  URL_FETCH_TIMEOUT_MS,
  URL_MAX_BYTES,
  URL_MAX_REDIRECTS,
  URL_SUPPORTED_MIME_TYPES,
} from '@/types/url-ingestion';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.goog',
]);

export class UrlFetchError extends Error {
  readonly code: UrlFetchErrorCode;
  readonly httpStatus: number;

  constructor(message: string, code: UrlFetchErrorCode, httpStatus = 400) {
    super(message);
    this.name = 'UrlFetchError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function normalizeContentType(value: string | null): string {
  if (!value) {
    return '';
  }

  return value.split(';')[0]?.trim().toLowerCase() ?? '';
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts;

  if (a === undefined || b === undefined) {
    return true;
  }

  if (a === 10) {
    return true;
  }

  if (a === 127) {
    return true;
  }

  if (a === 0) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === '::1') {
    return true;
  }

  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }

  if (normalized.startsWith('fe80:')) {
    return true;
  }

  return false;
}

function isPrivateIpAddress(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) {
    return isPrivateIPv4(ip);
  }

  if (version === 6) {
    return isPrivateIPv6(ip);
  }

  return true;
}

async function assertPublicHostname(hostname: string): Promise<void> {
  const normalizedHost = hostname.trim().toLowerCase().replace(/\.$/, '');

  if (!normalizedHost) {
    throw new UrlFetchError('URL inválida: host ausente.', 'INVALID_URL');
  }

  if (BLOCKED_HOSTNAMES.has(normalizedHost)) {
    throw new UrlFetchError(
      'URL aponta para um host não permitido. Use apenas endereços públicos acessíveis sem autenticação.',
      'PRIVATE_HOST',
      403,
    );
  }

  const literalIpVersion = isIP(normalizedHost);

  if (literalIpVersion > 0) {
    if (isPrivateIpAddress(normalizedHost)) {
      throw new UrlFetchError(
        'URL aponta para endereço de rede privada ou local. Informe uma URL publicamente acessível.',
        'PRIVATE_HOST',
        403,
      );
    }
    return;
  }

  let records: LookupAddress[];

  try {
    records = await lookup(normalizedHost, { all: true });
  } catch {
    throw new UrlFetchError(
      'Não foi possível resolver o host da URL. Verifique o endereço e tente novamente.',
      'UNREACHABLE',
      502,
    );
  }

  const resolved = Array.isArray(records) ? records : [records];

  for (const record of resolved) {
    if (isPrivateIpAddress(record.address)) {
      throw new UrlFetchError(
        'URL resolve para endereço de rede privada ou local. Use apenas URLs públicas.',
        'PRIVATE_HOST',
        403,
      );
    }
  }
}

export function parsePublicHttpUrl(rawUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new UrlFetchError('URL inválida. Informe um endereço http(s) completo.', 'INVALID_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UrlFetchError(
      'Apenas URLs http:// ou https:// são permitidas.',
      'INVALID_URL',
    );
  }

  if (parsed.username || parsed.password) {
    throw new UrlFetchError(
      'URLs com credenciais embutidas não são permitidas.',
      'INVALID_URL',
    );
  }

  return parsed;
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = parsePublicHttpUrl(rawUrl);
  await assertPublicHostname(parsed.hostname);
  return parsed;
}

function filenameFromUrl(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean);
  const lastSegment = segments.at(-1);

  if (!lastSegment) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(lastSegment);
    return decoded.length > 0 ? decoded : null;
  } catch {
    return lastSegment;
  }
}

function sniffFileType(
  buffer: Buffer,
  filename: string,
  contentType: string,
): string | null {
  const fromHeader = resolveUrlFileType(filename, contentType);
  if (fromHeader) {
    return fromHeader;
  }

  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return resolveUrlFileType('documento.pdf', 'application/pdf');
  }

  const head = buffer.subarray(0, 512).toString('utf-8').trim().toLowerCase();

  if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.includes('<body')) {
    return resolveUrlFileType('pagina.html', 'text/html');
  }

  if (head.length > 0 && !head.includes('\0')) {
    return resolveUrlFileType('documento.txt', 'text/plain');
  }

  return null;
}

function resolveFilename(url: URL, contentType: string, fileType: string): string {
  const fromPath = filenameFromUrl(url);

  if (fromPath && getFileExtension(fromPath)) {
    return fromPath;
  }

  if (fromPath && !fromPath.includes('.')) {
    const extension = fileType === 'html' ? 'html' : fileType;
    return `${fromPath}.${extension}`;
  }

  void contentType;
  return defaultFilenameForUrlFileType(fileType);
}

function mapHttpStatusToMessage(status: number, url: string): UrlFetchError {
  if (status === 401 || status === 403) {
    return new UrlFetchError(
      'A URL exige autenticação ou bloqueia acesso público. RF-003 aceita apenas conteúdo aberto, sem login.',
      'AUTH_REQUIRED',
      403,
    );
  }

  if (status === 404) {
    return new UrlFetchError(
      'A URL não foi encontrada (HTTP 404). Verifique o endereço.',
      'NOT_FOUND',
      404,
    );
  }

  return new UrlFetchError(
    `Falha ao acessar a URL (HTTP ${status}): ${url}`,
    'HTTP_ERROR',
    status >= 500 ? 502 : 400,
  );
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > maxBytes) {
      throw new UrlFetchError(
        `Conteúdo da URL excede o limite de ${formatMegabytes(maxBytes)}.`,
        'SIZE_LIMIT',
        413,
      );
    }

    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > maxBytes) {
        await reader.cancel();
        throw new UrlFetchError(
          `Conteúdo da URL excede o limite de ${formatMegabytes(maxBytes)}.`,
          'SIZE_LIMIT',
          413,
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

async function fetchUrlOnce(url: URL, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/pdf,text/plain,text/markdown;q=0.9,*/*;q=0.8',
        'User-Agent': 'SEI-Perceptio-UrlIngest/1.0',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UrlFetchError(
        `Tempo esgotado ao acessar a URL (limite de ${Math.round(timeoutMs / 1000)}s). Tente novamente ou escolha outro endereço.`,
        'TIMEOUT',
        504,
      );
    }

    throw new UrlFetchError(
      'Não foi possível acessar a URL. Verifique conectividade, firewall ou se o site está online.',
      'UNREACHABLE',
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRedirects(startUrl: URL): Promise<{ response: Response; finalUrl: URL }> {
  let currentUrl = startUrl;

  for (let redirectCount = 0; redirectCount <= URL_MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicHostname(currentUrl.hostname);

    const response = await fetchUrlOnce(currentUrl, URL_FETCH_TIMEOUT_MS);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');

      if (!location) {
        throw new UrlFetchError(
          'Redirecionamento inválido retornado pelo servidor remoto.',
          'HTTP_ERROR',
          502,
        );
      }

      currentUrl = new URL(location, currentUrl);
      await validatePublicUrl(currentUrl.toString());
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new UrlFetchError(
    'A URL excedeu o número máximo de redirecionamentos.',
    'HTTP_ERROR',
    502,
  );
}

export async function fetchPublicUrlContent(rawUrl: string): Promise<FetchedUrlContent> {
  const initialUrl = await validatePublicUrl(rawUrl);
  const { response, finalUrl } = await fetchWithRedirects(initialUrl);

  if (!response.ok) {
    throw mapHttpStatusToMessage(response.status, finalUrl.toString());
  }

  const contentType = normalizeContentType(response.headers.get('content-type'));

  const buffer = await readBodyWithLimit(response, URL_MAX_BYTES);

  if (buffer.byteLength === 0) {
    throw new UrlFetchError(
      'A URL retornou conteúdo vazio.',
      'EMPTY_CONTENT',
      422,
    );
  }

  const provisionalFilename =
    filenameFromUrl(finalUrl) ?? defaultFilenameForUrlFileType('html');

  if (
    contentType
    && contentType !== 'application/octet-stream'
    && !URL_SUPPORTED_MIME_TYPES.has(contentType)
  ) {
    throw new UrlFetchError(
      formatUnsupportedUrlTypeMessage(provisionalFilename, contentType),
      'UNSUPPORTED_TYPE',
      415,
    );
  }

  const fileType = sniffFileType(buffer, provisionalFilename, contentType);

  if (!fileType) {
    throw new UrlFetchError(
      formatUnsupportedUrlTypeMessage(provisionalFilename, contentType),
      'UNSUPPORTED_TYPE',
      415,
    );
  }

  const filename = resolveFilename(finalUrl, contentType, fileType);

  return {
    buffer,
    contentType: contentType || (fileType === 'pdf' ? 'application/pdf' : 'text/html'),
    fileType,
    filename,
    finalUrl: finalUrl.toString(),
    sizeBytes: buffer.byteLength,
  };
}

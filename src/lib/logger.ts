import 'server-only';

import pino, { type Logger } from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

function resolveLogLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();

  if (LOG_LEVELS.includes(raw as LogLevel)) {
    return raw as LogLevel;
  }

  return 'info';
}

export const logger: Logger = pino({
  level: resolveLogLevel(),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'sei-perceptio',
  },
});

export type AppLogger = Logger;

export function createRequestLogger(
  requestId: string,
  bindings?: Record<string, unknown>,
): AppLogger {
  return logger.child({
    request_id: requestId,
    ...bindings,
  });
}

export function getRequestId(request: Request): string {
  const existing = request.headers.get('x-request-id')?.trim();

  if (existing) {
    return existing;
  }

  return crypto.randomUUID();
}

export function getRouteLogger(
  request: Request,
  route: string,
): { requestId: string; log: AppLogger } {
  const requestId = getRequestId(request);

  return {
    requestId,
    log: createRequestLogger(requestId, { route }),
  };
}

export function logError(
  log: AppLogger,
  message: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  log.error(
    {
      err: error,
      ...context,
    },
    message,
  );
}

export function withRequestIdHeader<T extends Response>(response: T, requestId: string): T {
  response.headers.set('x-request-id', requestId);
  return response;
}

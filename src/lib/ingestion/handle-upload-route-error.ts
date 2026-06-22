import { NextResponse } from 'next/server';
import { z } from 'zod';

import { uploadDedupErrorResponse } from '@/lib/dedup/upload-response';
import { OrgLimitExceededError } from '@/lib/governance/org-limits';
import { SigiloBlockedError } from '@/lib/ingestion/sigilo-guard';
import { UploadPipelineError } from '@/lib/ingestion/upload-pipeline-error';
import { UrlFetchError } from '@/lib/ingestion/url-fetch';
import { logError, type AppLogger } from '@/lib/logger';

export function handleUploadRouteError(
  error: unknown,
  log: AppLogger,
  route: string,
): NextResponse {
  const dedupResponse = uploadDedupErrorResponse(error);
  if (dedupResponse) {
    return dedupResponse;
  }

  if (error instanceof UrlFetchError) {
    log.warn(
      { event: 'url_fetch_failed', code: error.code, route },
      error.message,
    );
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.httpStatus },
    );
  }

  if (error instanceof OrgLimitExceededError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        limit: error.limit,
        current: error.current,
      },
      { status: 422 },
    );
  }

  if (error instanceof SigiloBlockedError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
  }

  if (error instanceof UploadPipelineError) {
    logError(log, `${route} pipeline error`, error, { stage: error.stage });
    return NextResponse.json(
      { error: error.clientMessage, stage: error.stage },
      { status: error.httpStatus },
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues }, { status: 400 });
  }

  logError(log, `${route} unexpected error`, error);
  console.error(`[${route}] erro:`, error instanceof Error ? error.stack : error);

  const isDev = process.env.NODE_ENV !== 'production';
  const message =
    error instanceof Error ? error.message : 'Internal Server Error';

  return NextResponse.json(
    isDev
      ? { error: message, detail: error instanceof Error ? error.stack : String(error) }
      : { error: 'Internal Server Error' },
    { status: 500 },
  );
}

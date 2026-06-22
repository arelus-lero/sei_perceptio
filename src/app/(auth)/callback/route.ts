import { NextResponse } from 'next/server';

import { createRequestLogger, getRequestId, logError, withRequestIdHeader } from '@/lib/logger';
import { createServerClient } from '@/lib/supabase/server';

function hasCompleteAppMetadata(user: {
  app_metadata?: Record<string, unknown>;
}): boolean {
  const orgaoId = user.app_metadata?.orgao_id;
  const role = user.app_metadata?.role;

  return (
    typeof orgaoId === 'string'
    && orgaoId.length > 0
    && (role === 'admin' || role === 'analista' || role === 'consultor')
  );
}

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const log = createRequestLogger(requestId, { route: 'GET /callback' });
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const nextPath = requestUrl.searchParams.get('next') ?? '/dashboard';
  const safeNext = nextPath.startsWith('/') ? nextPath : '/dashboard';

  if (!code) {
    log.warn({ event: 'auth_callback_missing_code' }, 'Auth callback without code');
    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'auth_missing_code');
    return withRequestIdHeader(NextResponse.redirect(loginUrl), requestId);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logError(log, 'Auth callback exchangeCodeForSession failed', error);
    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'auth_callback');
    return withRequestIdHeader(NextResponse.redirect(loginUrl), requestId);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !hasCompleteAppMetadata(user)) {
    log.warn(
      { event: 'auth_callback_incomplete_metadata', user_id: user?.id ?? null },
      'Auth callback with incomplete app metadata',
    );
    await supabase.auth.signOut();
    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'auth_incomplete');
    return withRequestIdHeader(NextResponse.redirect(loginUrl), requestId);
  }

  log.info({ event: 'auth_callback_success', user_id: user.id }, 'Auth callback succeeded');
  return withRequestIdHeader(
    NextResponse.redirect(new URL(safeNext, requestUrl.origin)),
    requestId,
  );
}

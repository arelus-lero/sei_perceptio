import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isConsultorWriteBlocked } from '@/lib/auth/route-access';
import type { UserRole } from '@/lib/db/schema';

interface PendingCookie {
  name: string;
  value: string;
  options?: Parameters<NextResponse['cookies']['set']>[2];
}

const PUBLIC_PATHS = ['/login', '/callback'] as const;
const PUBLIC_API_PREFIX = '/api/auth';
const PUBLIC_HEALTH_PATH = '/api/health';
const PUBLIC_INNGEST_PATH = '/api/inngest';
const REQUEST_ID_HEADER = 'x-request-id';

function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  return { url, anonKey };
}

function resolveRequestId(request: NextRequest): string {
  const existing = request.headers.get(REQUEST_ID_HEADER)?.trim();

  if (existing) {
    return existing;
  }

  return crypto.randomUUID();
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }

  if (pathname === PUBLIC_HEALTH_PATH || pathname.startsWith(PUBLIC_INNGEST_PATH)) {
    return true;
  }

  return pathname.startsWith(PUBLIC_API_PREFIX);
}

function requiresAdmin(pathname: string): boolean {
  return (
    pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname.startsWith('/api/admin')
  );
}

function parseUserRole(value: unknown): UserRole | null {
  if (value === 'admin' || value === 'analista' || value === 'consultor') {
    return value;
  }

  return null;
}

function parseOrgaoId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function applyPendingCookies(
  response: NextResponse,
  pendingCookies: PendingCookie[],
): NextResponse {
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}

function finalizeResponse(
  response: NextResponse,
  pendingCookies: PendingCookie[],
  requestId: string,
): NextResponse {
  const finalized = applyPendingCookies(response, pendingCookies);
  finalized.headers.set(REQUEST_ID_HEADER, requestId);
  return finalized;
}

function redirectToLogin(
  request: NextRequest,
  pendingCookies: PendingCookie[],
  errorCode: string,
  requestId: string,
): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('error', errorCode);

  return finalizeResponse(NextResponse.redirect(loginUrl), pendingCookies, requestId);
}

export async function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request);
  const { url, anonKey } = getSupabasePublicEnv();
  const { pathname } = request.nextUrl;
  const pendingCookies: PendingCookie[] = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        pendingCookies.length = 0;
        pendingCookies.push(...cookiesToSet);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    return redirectToLogin(request, pendingCookies, 'auth_required', requestId);
  }

  const orgaoId = parseOrgaoId(user?.app_metadata?.orgao_id);
  const role = parseUserRole(user?.app_metadata?.role);

  if (user && !isPublic && (!orgaoId || !role)) {
    await supabase.auth.signOut();
    return redirectToLogin(request, pendingCookies, 'auth_incomplete', requestId);
  }

  if (user && requiresAdmin(pathname) && role !== 'admin') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';

    return finalizeResponse(
      NextResponse.redirect(dashboardUrl),
      pendingCookies,
      requestId,
    );
  }

  if (
    user
    && isConsultorWriteBlocked(pathname, request.method, role)
  ) {
    if (pathname.startsWith('/api/')) {
      return finalizeResponse(
        NextResponse.json(
          { error: 'Consultor não possui permissão de escrita neste recurso' },
          { status: 403 },
        ),
        pendingCookies,
        requestId,
      );
    }

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';

    return finalizeResponse(
      NextResponse.redirect(dashboardUrl),
      pendingCookies,
      requestId,
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  if (orgaoId) {
    requestHeaders.set('x-orgao-id', orgaoId);
  }

  if (role) {
    requestHeaders.set('x-user-role', role);
  }

  return finalizeResponse(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    pendingCookies,
    requestId,
  );
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

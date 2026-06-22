import { createAdminClient } from '@/lib/supabase/admin';
import type { HealthCheckResult } from '@/types/health';

const DEFAULT_CHECK_TIMEOUT_MS = 5_000;
const DEFAULT_LLM_PING_TIMEOUT_MS = 3_000;

function elapsed(start: number): number {
  return Date.now() - start;
}

function getCheckTimeoutMs(): number {
  const parsed = Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? DEFAULT_CHECK_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CHECK_TIMEOUT_MS;
}

function getLlmPingTimeoutMs(): number {
  const parsed = Number(process.env.HEALTH_LLM_TIMEOUT_MS ?? DEFAULT_LLM_PING_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LLM_PING_TIMEOUT_MS;
}

function okResult(start: number): HealthCheckResult {
  return { status: 'ok', latency_ms: elapsed(start) };
}

function errorResult(start: number, message: string): HealthCheckResult {
  return { status: 'error', latency_ms: elapsed(start), message };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

export async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();

  try {
    const supabase = createAdminClient();
    const { error } = await withTimeout(
      Promise.resolve(
        supabase.from('orgao').select('id', { head: true, count: 'exact' }),
      ),
      getCheckTimeoutMs(),
      'db',
    );

    if (error) {
      return errorResult(start, error.message);
    }

    return okResult(start);
  } catch (error) {
    return errorResult(
      start,
      error instanceof Error ? error.message : 'Database check failed',
    );
  }
}

export async function checkAuth(): Promise<HealthCheckResult> {
  const start = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return errorResult(start, 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  try {
    const response = await withTimeout(
      fetch(`${url}/auth/v1/health`, {
        headers: { apikey: anonKey },
        cache: 'no-store',
      }),
      getCheckTimeoutMs(),
      'auth',
    );

    if (!response.ok) {
      return errorResult(start, `Auth health HTTP ${response.status}`);
    }

    return okResult(start);
  } catch (error) {
    return errorResult(
      start,
      error instanceof Error ? error.message : 'Auth check failed',
    );
  }
}

export async function checkStorage(): Promise<HealthCheckResult> {
  const start = Date.now();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_DOCUMENTS ?? 'documentos';

  try {
    const supabase = createAdminClient();
    const { error } = await withTimeout(
      supabase.storage.from(bucket).list('', { limit: 1 }),
      getCheckTimeoutMs(),
      'storage',
    );

    if (error) {
      return errorResult(start, error.message);
    }

    return okResult(start);
  } catch (error) {
    return errorResult(
      start,
      error instanceof Error ? error.message : 'Storage check failed',
    );
  }
}

export async function checkLlm(): Promise<HealthCheckResult> {
  const start = Date.now();
  const apiUrl = process.env.LLM_API_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;

  if (!apiUrl || !apiKey || !model) {
    return errorResult(start, 'Missing LLM_API_URL, LLM_API_KEY, or LLM_MODEL');
  }

  const abortController = new AbortController();
  const timeoutMs = getLlmPingTimeoutMs();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: abortController.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      const body = await response.text();
      return errorResult(
        start,
        `LLM ping HTTP ${response.status}: ${body.slice(0, 200)}`,
      );
    }

    return okResult(start);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return errorResult(start, `LLM ping timed out after ${timeoutMs}ms`);
    }

    return errorResult(
      start,
      error instanceof Error ? error.message : 'LLM ping failed',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runHealthChecks(): Promise<{
  checks: {
    db: HealthCheckResult;
    auth: HealthCheckResult;
    storage: HealthCheckResult;
    llm: HealthCheckResult;
  };
  allOk: boolean;
}> {
  const [db, auth, storage, llm] = await Promise.all([
    checkDatabase(),
    checkAuth(),
    checkStorage(),
    checkLlm(),
  ]);

  const checks = { db, auth, storage, llm };
  const allOk = Object.values(checks).every((check) => check.status === 'ok');

  return { checks, allOk };
}

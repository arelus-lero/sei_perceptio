import { NextResponse } from 'next/server';

import { runHealthChecks } from '@/lib/health/checks';
import type { HealthResponseBody } from '@/types/health';

export async function GET(): Promise<NextResponse<HealthResponseBody>> {
  const { checks, allOk } = await runHealthChecks();

  const body: HealthResponseBody = {
    status: allOk ? 'ok' : 'error',
    checks,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: allOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

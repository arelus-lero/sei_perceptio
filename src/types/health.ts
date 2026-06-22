export type HealthCheckName = 'db' | 'auth' | 'storage' | 'llm';

export type HealthCheckStatus = 'ok' | 'error';

export interface HealthCheckResult {
  status: HealthCheckStatus;
  latency_ms: number;
  message?: string;
}

export type HealthChecks = Record<HealthCheckName, HealthCheckResult>;

export interface HealthResponseBody {
  status: 'ok' | 'error';
  checks: HealthChecks;
  timestamp: string;
}

/**
 * RNF-005 — k6: 100 VUs simultâneos (dashboard + chat), reporta P95.
 *
 * Pré-requisitos:
 *   - k6 instalado (https://k6.io/docs/get-started/installation/)
 *   - App rodando: npm run build && npm run start  (ou npm run dev)
 *   - node scripts/load/prepare-auth.mjs  → gera scripts/load/.env.loadtest
 *
 * Execução:
 *   k6 run scripts/load/rnf-005-k6.js
 *   # ou com env inline:
 *   k6 run -e BASE_URL=http://localhost:3000 -e NOTEBOOK_ID=<uuid> scripts/load/rnf-005-k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const dashboardP95 = new Trend('dashboard_duration', true);
const chatP95 = new Trend('chat_duration', true);

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const NOTEBOOK_ID = __ENV.NOTEBOOK_ID || '';
const CHAT_MESSAGE = __ENV.CHAT_MESSAGE || 'Resuma os principais pontos das fontes ativas.';
const LOAD_TEST_DURATION = __ENV.LOAD_TEST_DURATION || '2m';
const DASHBOARD_WEIGHT = Number(__ENV.DASHBOARD_WEIGHT || '0.5');

export const options = {
  scenarios: {
    concurrent_users: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || '100'),
      duration: LOAD_TEST_DURATION,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{endpoint:dashboard}': ['p(95)<3000'],
    'http_req_duration{endpoint:chat}': ['p(95)<15000'],
    dashboard_duration: ['p(95)<3000'],
    chat_duration: ['p(95)<15000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

function authHeaders(session) {
  return {
    Cookie: session.cookie,
    'Content-Type': 'application/json',
    Accept: 'text/html,application/json',
  };
}

function chatHeaders(session) {
  return {
    Cookie: session.cookie,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
}

export function setup() {
  const cookie = __ENV.LOAD_TEST_COOKIE;
  const cookieName = __ENV.LOAD_TEST_COOKIE_NAME;

  if (cookie && cookieName) {
    return { cookie: `${cookieName}=${cookie}` };
  }

  const supabaseUrl = __ENV.SUPABASE_URL || __ENV.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = __ENV.SUPABASE_ANON_KEY || __ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = __ENV.LOAD_TEST_EMAIL;
  const password = __ENV.LOAD_TEST_PASSWORD;

  if (!supabaseUrl || !anonKey || !email || !password) {
    throw new Error(
      'Defina LOAD_TEST_COOKIE + LOAD_TEST_COOKIE_NAME (via prepare-auth.mjs) '
        + 'ou SUPABASE_URL, SUPABASE_ANON_KEY, LOAD_TEST_EMAIL, LOAD_TEST_PASSWORD',
    );
  }

  const loginRes = http.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
    },
  );

  if (loginRes.status !== 200) {
    throw new Error(`Login falhou (${loginRes.status}): ${loginRes.body}`);
  }

  const session = JSON.parse(loginRes.body);
  const name =
    cookieName
    || __ENV.LOAD_TEST_COOKIE_NAME
    || `sb-${supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]}-auth-token`;

  const payload = encodeURIComponent(
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type,
      user: session.user,
    }),
  );

  return { cookie: `${name}=${payload}` };
}

export default function loadTest(session) {
  const useDashboard = Math.random() < DASHBOARD_WEIGHT;

  if (useDashboard) {
    const res = http.get(`${BASE_URL}/dashboard`, {
      headers: authHeaders(session),
      tags: { endpoint: 'dashboard' },
      timeout: '30s',
    });

    check(res, {
      'dashboard status 200': (r) => r.status === 200,
    });

    dashboardP95.add(res.timings.duration);

    const apiRes = http.get(`${BASE_URL}/api/dashboard/processos?limit=50`, {
      headers: authHeaders(session),
      tags: { endpoint: 'dashboard_api' },
      timeout: '15s',
    });

    check(apiRes, {
      'dashboard api status 200': (r) => r.status === 200,
    });
  } else {
    if (!NOTEBOOK_ID) {
      sleep(1);
      return;
    }

    const body = JSON.stringify({
      notebook_id: NOTEBOOK_ID,
      conversa_id: null,
      mensagem: CHAT_MESSAGE,
      fontes_ativas: [],
    });

    const res = http.post(`${BASE_URL}/api/chat`, body, {
      headers: chatHeaders(session),
      tags: { endpoint: 'chat' },
      timeout: '120s',
    });

    check(res, {
      'chat status 200': (r) => r.status === 200,
      'chat sse': (r) =>
        (r.headers['Content-Type'] || '').includes('text/event-stream')
        || r.body.includes('"type"'),
    });

    chatP95.add(res.timings.duration);
  }

  sleep(Number(__ENV.THINK_TIME || '1'));
}

export function handleSummary(data) {
  const dashboardMetric = data.metrics['http_req_duration{endpoint:dashboard}']
    || data.metrics.dashboard_duration;
  const chatMetric = data.metrics['http_req_duration{endpoint:chat}']
    || data.metrics.chat_duration;

  const lines = [
    '# RNF-005 — Resumo k6',
    '',
    `| Métrica | P95 (ms) | Threshold |`,
    `|---------|----------|-----------|`,
    `| Dashboard (GET /dashboard) | ${formatP95(dashboardMetric)} | ≤ 3000 |`,
    `| Chat (POST /api/chat) | ${formatP95(chatMetric)} | ≤ 15000 |`,
    '',
    `VUs: ${__ENV.VUS || '100'} · Duração: ${LOAD_TEST_DURATION} · Base: ${BASE_URL}`,
    '',
    'Relatório JSON completo: stdout',
  ];

  return {
    stdout: JSON.stringify(data, null, 2),
    'docs/rnf-005-load-test-results.md': lines.join('\n'),
  };
}

function formatP95(metric) {
  if (!metric || !metric.values || metric.values['p(95)'] === undefined) {
    return 'n/a';
  }
  return Math.round(metric.values['p(95)']).toString();
}

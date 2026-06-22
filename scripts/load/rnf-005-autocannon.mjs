#!/usr/bin/env node
/**
 * RNF-005 — autocannon: alternativa leve ao k6 (dashboard + API).
 * Uso: node scripts/load/rnf-005-autocannon.mjs
 */

import autocannon from 'autocannon';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(process.cwd(), 'scripts/load/.env.loadtest'));

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const cookieName = process.env.LOAD_TEST_COOKIE_NAME;
const cookieValue = process.env.LOAD_TEST_COOKIE;

if (!cookieName || !cookieValue) {
  console.error('Execute primeiro: node scripts/load/prepare-auth.mjs');
  process.exit(1);
}

const cookieHeader = `${cookieName}=${cookieValue}`;
const connections = Number(process.env.VUS || '100');
const duration = Number(process.env.AUTOCANNON_DURATION || '30');

async function runTarget(name, url, method = 'GET', body = undefined) {
  return new Promise((resolvePromise, reject) => {
    const instance = autocannon(
      {
        url,
        connections,
        duration,
        method,
        headers: {
          cookie: cookieHeader,
          'content-type': 'application/json',
          accept: method === 'GET' ? 'text/html' : 'application/json',
        },
        body,
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolvePromise({ name, result });
      },
    );

    autocannon.track(instance, { renderProgressBar: true });
  });
}

console.log(`Autocannon · ${connections} conexões · ${duration}s · ${baseUrl}\n`);

const dashboard = await runTarget('dashboard', `${baseUrl}/dashboard`);
const dashboardApi = await runTarget(
  'dashboard_api',
  `${baseUrl}/api/dashboard/processos?limit=50`,
);

const notebookId = process.env.NOTEBOOK_ID;
let chat = null;

if (notebookId) {
  chat = await runTarget(
    'chat',
    `${baseUrl}/api/chat`,
    'POST',
    JSON.stringify({
      notebook_id: notebookId,
      conversa_id: null,
      mensagem: process.env.CHAT_MESSAGE || 'Teste de carga RNF-005',
      fontes_ativas: [],
    }),
  );
}

function p95(latency) {
  return latency.p97_5 ?? latency.p99 ?? latency.max;
}

const summary = [
  '# RNF-005 — Resumo autocannon',
  '',
  '| Endpoint | P95 (ms) | Req/s | Erros |',
  '|----------|----------|-------|-------|',
  `| GET /dashboard | ${Math.round(p95(dashboard.result.latency))} | ${dashboard.result.requests.average.toFixed(1)} | ${dashboard.result.errors} |`,
  `| GET /api/dashboard/processos | ${Math.round(p95(dashboardApi.result.latency))} | ${dashboardApi.result.requests.average.toFixed(1)} | ${dashboardApi.result.errors} |`,
];

if (chat) {
  summary.push(
    `| POST /api/chat | ${Math.round(p95(chat.result.latency))} | ${chat.result.requests.average.toFixed(1)} | ${chat.result.errors} |`,
  );
} else {
  summary.push('| POST /api/chat | (omitido — defina NOTEBOOK_ID) | — | — |');
}

summary.push('', `_Gerado em ${new Date().toISOString()}_`);

const out = summary.join('\n');
console.log('\n' + out);

writeFileSync(resolve(process.cwd(), 'docs/rnf-005-load-test-results.md'), out, 'utf8');

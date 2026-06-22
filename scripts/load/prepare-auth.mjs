#!/usr/bin/env node
/**
 * Obtém sessão Supabase e grava variáveis para k6/autocannon.
 * Uso: node scripts/load/prepare-auth.mjs [--env .env.local]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional file
  }
}

const envArgIndex = process.argv.indexOf('--env');
const envPath =
  envArgIndex >= 0 ? process.argv[envArgIndex + 1] : '.env.local';

loadEnvFile(resolve(process.cwd(), envPath));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.LOAD_TEST_EMAIL;
const password = process.env.LOAD_TEST_PASSWORD;

if (!supabaseUrl || !anonKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios.');
  process.exit(1);
}

if (!email || !password) {
  console.error('Defina LOAD_TEST_EMAIL e LOAD_TEST_PASSWORD no .env.local');
  process.exit(1);
}

const projectRef =
  process.env.SUPABASE_PROJECT_REF
  || supabaseUrl.replace(/^https?:\/\//, '').split('.')[0];

const cookieName =
  process.env.LOAD_TEST_COOKIE_NAME || `sb-${projectRef}-auth-token`;

const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: anonKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});

if (!loginRes.ok) {
  console.error('Login falhou:', loginRes.status, await loginRes.text());
  process.exit(1);
}

const session = await loginRes.json();

const cookiePayload = encodeURIComponent(
  JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: session.token_type,
    user: session.user,
  }),
);

const outPath = resolve(process.cwd(), 'scripts/load/.env.loadtest');
const lines = [
  `# Gerado por prepare-auth.mjs — não commitar`,
  `LOAD_TEST_COOKIE=${cookiePayload}`,
  `LOAD_TEST_COOKIE_NAME=${cookieName}`,
  `SUPABASE_URL=${supabaseUrl}`,
  `SUPABASE_ANON_KEY=${anonKey}`,
  `LOAD_TEST_EMAIL=${email}`,
  `NOTEBOOK_ID=${process.env.LOAD_TEST_NOTEBOOK_ID || ''}`,
  `BASE_URL=${process.env.LOAD_TEST_BASE_URL || 'http://localhost:3000'}`,
  '',
];

writeFileSync(outPath, lines.join('\n'), 'utf8');

console.log(`OK: ${outPath}`);
console.log(`Cookie: ${cookieName}`);
console.log('Execute: k6 run --env-file scripts/load/.env.loadtest scripts/load/rnf-005-k6.js');

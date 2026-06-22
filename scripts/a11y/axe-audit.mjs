#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.A11Y_BASE_URL ?? 'http://127.0.0.1:3000';
const LOAD_TEST_EMAIL = process.env.LOAD_TEST_EMAIL;
const LOAD_TEST_PASSWORD = process.env.LOAD_TEST_PASSWORD;

const PUBLIC_ROUTES = [
  { path: '/login', name: 'Login' },
];

const AUTH_ROUTES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/notebooks', name: 'Notebooks' },
];

function formatViolation(violation) {
  const nodes = violation.nodes
    .slice(0, 3)
    .map((node) => `  - ${node.target.join(' ')}`)
    .join('\n');

  return `[${violation.impact}] ${violation.id}: ${violation.help}\n${nodes}`;
}

async function waitForServer(url, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) {
        return;
      }
    } catch {
      // retry
    }
    await delay(1000);
  }

  throw new Error(`Servidor indisponível em ${url}. Execute "npm run dev" ou "npm run start".`);
}

async function loginIfConfigured(page) {
  if (!LOAD_TEST_EMAIL || !LOAD_TEST_PASSWORD) {
    return false;
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#password-email', LOAD_TEST_EMAIL);
  await page.fill('#password', LOAD_TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  return true;
}

async function auditRoute(page, path, name) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const violations = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );

  return { name, path, violations, passes: results.passes.length };
}

async function main() {
  const shouldStartServer = process.argv.includes('--start');
  let serverProcess;

  if (shouldStartServer) {
    serverProcess = spawn('npm', ['run', 'start'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, PORT: '3000' },
    });
    await delay(4000);
  }

  try {
    await waitForServer(`${BASE_URL}/login`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ locale: 'pt-BR' });
    const page = await context.newPage();

    const reports = [];

    for (const route of PUBLIC_ROUTES) {
      reports.push(await auditRoute(page, route.path, route.name));
    }

    const authenticated = await loginIfConfigured(page);
    if (authenticated) {
      for (const route of AUTH_ROUTES) {
        reports.push(await auditRoute(page, route.path, route.name));
      }
    } else {
      console.warn(
        'Rotas autenticadas ignoradas. Defina LOAD_TEST_EMAIL e LOAD_TEST_PASSWORD para auditar o dashboard.',
      );
    }

    await browser.close();

    let failed = false;

    for (const report of reports) {
      console.log(`\n=== ${report.name} (${report.path}) ===`);
      console.log(`Regras aprovadas: ${report.passes}`);

      if (report.violations.length === 0) {
        console.log('Nenhuma violação AA crítica/séria encontrada.');
        continue;
      }

      failed = true;
      console.log(`Violações (${report.violations.length}):`);
      for (const violation of report.violations) {
        console.log(formatViolation(violation));
      }
    }

    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Testes de borda para limites por órgão (RF-034).
 * Executar: npx tsx src/lib/governance/org-limits.invariants.ts
 */
import {
  buildFonteLimitMessage,
  buildNotebookLimitMessage,
  canAddWithinLimit,
} from '@/lib/governance/org-limits';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function testNotebookLimits(max: number): void {
  assert(
    canAddWithinLimit(max - 2, max),
    `notebooks limite-1 (${max - 2}): deveria permitir inserção`,
  );
  assert(
    !canAddWithinLimit(max - 1, max),
    `notebooks limite (${max - 1}): próxima inserção deveria ser bloqueada`,
  );
  assert(
    !canAddWithinLimit(max, max),
    `notebooks limite+1 (${max}): deveria estar bloqueado`,
  );

  assert(
    buildNotebookLimitMessage(max - 1, max).includes(`${max - 1}/${max}`),
    'mensagem de notebook deve incluir contagem atual/máxima',
  );
}

function testFonteLimits(max: number): void {
  assert(
    canAddWithinLimit(max - 2, max),
    `fontes limite-1 (${max - 2}): deveria permitir inserção`,
  );
  assert(
    !canAddWithinLimit(max - 1, max),
    `fontes limite (${max - 1}): próxima inserção deveria ser bloqueada`,
  );
  assert(
    !canAddWithinLimit(max, max),
    `fontes limite+1 (${max}): deveria estar bloqueado`,
  );

  assert(
    buildFonteLimitMessage(max - 1, max).includes(`${max - 1}/${max}`),
    'mensagem de fonte deve incluir contagem atual/máxima',
  );
}

function runOrgLimitsInvariants(): void {
  testNotebookLimits(500);
  testFonteLimits(300);
  console.log('Org limits invariants OK (limite-1, limite, limite+1)');
}

runOrgLimitsInvariants();

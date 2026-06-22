/**
 * Testes de borda do motor de retenção (RF-043).
 * Executar: npx tsx src/lib/governance/apply-retention.invariants.ts
 */
import {
  buildRetentionIdempotencyKey,
  computeExpirationDate,
  isExpired,
  isRetentionAlreadyApplied,
  resolveDryRun,
} from '@/lib/governance/retention-types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runApplyRetentionInvariants(): void {
  const reference = '2024-01-01T00:00:00.000Z';
  const expiration = computeExpirationDate(reference, {
    tipo: 'periodo_dias',
    valor: 30,
  });

  assert(
    isExpired(expiration, new Date('2024-02-01T00:00:00.000Z')),
    'deveria expirar após 30 dias',
  );
  assert(
    !isExpired(expiration, new Date('2024-01-15T00:00:00.000Z')),
    'não deveria expirar antes de 30 dias',
  );

  const key = buildRetentionIdempotencyKey(
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
  );
  assert(key.startsWith('retencao:'), 'idempotency key deve ter prefixo retencao');

  assert(
    isRetentionAlreadyApplied(
      {
        politica_id: 'p1',
        politica_nome: 'Teste',
        acao: 'excluir',
        status: 'aprovacao_pendente',
        expirado_em: reference,
        marcado_em: reference,
        idempotency_key: key,
      },
      'p1',
    ),
    'marker de aprovação pendente deve bloquear reprocessamento',
  );

  assert(resolveDryRun(undefined, 'true'), 'RETENTION_DRY_RUN=true habilita dry-run');
  assert(!resolveDryRun(false, 'true'), 'event dryRun=false sobrescreve env');

  console.log('Apply retention invariants OK');
}

runApplyRetentionInvariants();

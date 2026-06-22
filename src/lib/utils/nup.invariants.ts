/**
 * Invariantes do algoritmo NUP (Portaria IM nº 11/2019).
 * Executar: npx tsx src/lib/utils/nup.invariants.ts
 */
import { calcularDvNup, validarNup } from './nup';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runNupInvariants(): void {
  assert(
    calcularDvNup('230370014622021') === '65',
    `DV exemplo oficial: esperado 65, obtido ${calcularDvNup('230370014622021')}`,
  );

  assert(
    validarNup('23037.001462/2021-65'),
    'validarNup falhou para exemplo oficial 23037.001462/2021-65',
  );

  assert(
    calcularDvNup('350410003872000') === '19',
    `DV Portaria anexo (35041.000387/2000): esperado 19, obtido ${calcularDvNup('350410003872000')}`,
  );

  assert(
    validarNup('35041.000387/2000-19'),
    'validarNup falhou para exemplo da Portaria 35041.000387/2000-19',
  );

  console.log('NUP invariants OK');
}

runNupInvariants();

import {
  computeSimhash,
  isSimilarSimhash,
  simhashSimilarity,
  SIMHASH_SIMILARITY_THRESHOLD,
} from '@/lib/dedup/simhash';
import { parseUploadConfirmationFlag } from '@/lib/dedup/check-upload-duplicates';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const baseText =
  'Processo administrativo SEI 48500.012345/2025-01 sobre revisão tarifária e consulta pública.';

const nearDuplicateText =
  'Processo administrativo SEI 48500.012345/2025-01 sobre revisão tarifária e audiência pública.';

const differentText =
  'Relatório técnico de inspeção de subestação elétrica em região metropolitana.';

const hashA = computeSimhash(baseText);
const hashB = computeSimhash(nearDuplicateText);
const hashC = computeSimhash(differentText);

assert(hashA.length === 16, 'simhash deve ter 16 caracteres hex');
assert(hashA !== hashC, 'textos distintos devem gerar simhashes distintos');
assert(
  isSimilarSimhash(hashA, hashB),
  `textos próximos devem exceder limiar de ${SIMHASH_SIMILARITY_THRESHOLD * 100}%`,
);
assert(
  !isSimilarSimhash(hashA, hashC),
  'textos distintos não devem exceder limiar de similaridade',
);

assert(
  simhashSimilarity(hashA, hashA) === 1,
  'similaridade de hash consigo mesmo deve ser 100%',
);

assert(parseUploadConfirmationFlag('true') === true, 'flag true deve ser aceita');
assert(parseUploadConfirmationFlag('1') === true, 'flag 1 deve ser aceita');
assert(parseUploadConfirmationFlag('false') === false, 'flag false deve ser rejeitada');
assert(parseUploadConfirmationFlag(null) === false, 'flag ausente deve ser rejeitada');

console.log('simhash.invariants: simhash + dedup flags OK');

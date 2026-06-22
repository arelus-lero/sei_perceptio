import {
  buildDocumentStorageKey,
  sanitizeFileExtension,
  sanitizeStorageBaseName,
  sanitizeStorageFileSegment,
} from '@/lib/utils/storage-key';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const orgaoId = 'ec4de49b-4b84-5aa7-9a3d-4a3f94ab39d5';
const notebookId = 'b306a781-3168-4cd0-83aa-1b2559dcb4d0';
const objectId = '11111111-2222-3333-4444-555555555555';

const accentedName =
  'Solução de Conflitos-Processo Administrativo de Regulação Econômica.pdf';

assert(
  sanitizeStorageBaseName('Solução de Conflitos') === 'Solucao_de_Conflitos',
  'base name should strip accents and replace spaces',
);

assert(sanitizeFileExtension('PDF') === 'pdf', 'extension should be lowercase letters only');
assert(sanitizeFileExtension('pd$f') === 'pdf', 'extension should drop invalid chars');

const safeSegment = sanitizeStorageFileSegment(accentedName);
assert(!/[^\w.-]/.test(safeSegment.replace(/_/g, 'X')), 'segment should be ASCII-safe');
assert(safeSegment.endsWith('.pdf'), 'segment should keep sanitized extension');

const key = buildDocumentStorageKey(orgaoId, notebookId, accentedName, objectId);
assert(
  key === `${orgaoId}/${notebookId}/${objectId}-Solucao_de_Conflitos-Processo_Administrativo_de_Regulacao_Economica.pdf`,
  `unexpected key: ${key}`,
);
assert(/^[a-zA-Z0-9/._-]+$/.test(key), 'key must match Supabase-safe charset');

console.log('storage-key invariants: ok');

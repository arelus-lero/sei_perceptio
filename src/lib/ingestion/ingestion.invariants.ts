import { extractHtmlText } from '@/lib/ingestion/html-text';
import { buildDocumentStorageKey } from '@/lib/utils/storage-key';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const seiHtmlLatin1 = `<!DOCTYPE html>
<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"></head>
<body>
<h1>Pesquisa Processual</h1>
<table>
  <tr><th>Documento</th><th>Data</th><th>Unidade</th></tr>
  <tr><td>Despacho n. 123</td><td>01/01/2024</td><td>SGD/ANEEL</td></tr>
  <tr><td>Of&iacute;cio n. 456</td><td>02/01/2024</td><td>SDE/ANEEL</td></tr>
</table>
<table>
  <tr><th>Andamento</th><th>Descri&ccedil;&atilde;o</th></tr>
  <tr><td>Tramita&ccedil;&atilde;o</td><td>Processo encaminhado para an&aacute;lise</td></tr>
</table>
</body>
</html>`;

const htmlResult = extractHtmlText(Buffer.from(seiHtmlLatin1, 'latin1'));

assert(htmlResult.method === 'html', 'expected html extraction method');
assert(htmlResult.encoding === 'latin1', `expected latin1, got ${htmlResult.encoding}`);
assert(Boolean(htmlResult.text?.includes('Despacho n. 123')), 'missing document row');
assert(Boolean(htmlResult.text?.includes('Ofício n. 456')), 'missing accented ofício cell');
assert(Boolean(htmlResult.text?.includes('Tramitação')), 'missing accented andamento cell');
assert(
  htmlResult.text?.includes('Despacho n. 123 | 01/01/2024 | SGD/ANEEL') === true,
  'table cells should be joined with pipe separator',
);

const accentedPdfName = 'Solução de Conflitos-Processo Administrativo.pdf';
const storageKey = buildDocumentStorageKey(
  'ec4de49b-4b84-5aa7-9a3d-4a3f94ab39d5',
  'b306a781-3168-4cd0-83aa-1b2559dcb4d0',
  accentedPdfName,
  '11111111-2222-3333-4444-555555555555',
);

assert(/^[a-zA-Z0-9/._-]+$/.test(storageKey), `unsafe storage key: ${storageKey}`);
assert(!storageKey.includes('Solução'), 'storage key must not contain original accents');

console.log('ingestion invariants: ok');

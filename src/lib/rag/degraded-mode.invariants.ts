import {
  buildDegradedResponseContent,
  DEGRADED_MODE_WARNING,
  streamDegradedResponse,
} from '@/lib/rag/degraded-mode';
import { isLlmFailure, LlmTimeoutError } from '@/lib/rag/llm-errors';
import type { RetrievedChunk } from '@/lib/rag/types';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const sampleChunks: RetrievedChunk[] = [
  {
    id: 'chunk-1',
    fonte_id: 'fonte-1',
    conteudo: 'Despacho sobre consulta pública do processo 48500.012345/2025-01.',
    metadados_json: {
      numero_sei: '48500.012345/2025-01',
      tipo_documento: 'Despacho',
      unidade_geradora: 'STD',
    },
    score_rrf: 0.91,
    numero_sei: '48500.012345/2025-01',
    tipo_documento: 'Despacho',
    unidade_geradora: 'STD',
  },
];

async function runInvariants(): Promise<void> {
  const content = buildDegradedResponseContent(sampleChunks);

  assert(content.includes(DEGRADED_MODE_WARNING), 'conteúdo degradado deve incluir aviso');
  assert(content.includes('Trechos recuperados'), 'conteúdo degradado deve listar trechos');
  assert(isLlmFailure(new LlmTimeoutError()), 'timeout deve ser falha de LLM');

  const stream = streamDegradedResponse(sampleChunks);
  const reader = stream.getReader();
  let streamed = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    streamed += value;
  }

  assert(streamed === content, 'stream degradado deve reproduzir conteúdo completo');
  console.log('degraded-mode.invariants: OK');
}

runInvariants().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import { AI_SEAL_MARKDOWN } from '@/lib/rag/prompts/system';
import type { RetrievedChunk } from '@/lib/rag/types';

export const DEGRADED_MODE_WARNING =
  'Resposta gerada por IA indisponível — exibindo trechos relevantes das fontes';

const EXCERPT_MAX_CHARS = 800;

function resolveChunkLabel(chunk: RetrievedChunk): {
  numeroSei: string;
  tipo: string;
  unidade: string;
} {
  return {
    numeroSei:
      chunk.numero_sei ?? String(chunk.metadados_json.numero_sei ?? 'N/A'),
    tipo:
      chunk.tipo_documento ??
      String(chunk.metadados_json.tipo_documento ?? 'N/A'),
    unidade:
      chunk.unidade_geradora ??
      String(chunk.metadados_json.unidade_geradora ?? 'N/A'),
  };
}

function formatExcerpt(text: string): string {
  const trimmed = text.trim().slice(0, EXCERPT_MAX_CHARS);
  return trimmed.replace(/\n/g, '\n> ');
}

export function buildDegradedResponseContent(chunks: RetrievedChunk[]): string {
  const warningBlock = `> ⚠️ ${DEGRADED_MODE_WARNING}`;

  let body: string;

  if (chunks.length === 0) {
    body = `${warningBlock}\n\nNão encontrei trechos relevantes nas fontes disponíveis para esta consulta.`;
  } else {
    const sections = chunks.map((chunk, index) => {
      const { numeroSei, tipo, unidade } = resolveChunkLabel(chunk);
      const header = `### ${index + 1}. [Fonte: ${numeroSei} | ${tipo} | ${unidade}]`;
      const excerpt = formatExcerpt(chunk.conteudo);
      return `${header}\n\n> ${excerpt}`;
    });

    body = `${warningBlock}\n\n## Trechos recuperados\n\n${sections.join('\n\n')}`;
  }

  return `${body}\n\n${AI_SEAL_MARKDOWN}`;
}

export function streamDegradedResponse(
  chunks: RetrievedChunk[],
): ReadableStream<string> {
  const content = buildDegradedResponseContent(chunks);
  const parts = content.match(/[^\n]*\n?/g) ?? [content];

  return new ReadableStream<string>({
    start(controller) {
      for (const part of parts) {
        if (part.length === 0) {
          continue;
        }
        controller.enqueue(part);
      }
      controller.close();
    },
  });
}

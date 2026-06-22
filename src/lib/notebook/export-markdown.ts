import { AI_SEAL_MARKDOWN, IA_DECLARATION } from '@/lib/rag/prompts/system';
import type { NotebookExportTraceability } from '@/types/notebook-share';

import type { NotebookExportData } from '@/lib/notebook/export-builder';

function formatIso(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function yamlEscape(value: string): string {
  return value.replace(/"/g, '\\"');
}

function renderFonteSection(data: NotebookExportData): string {
  if (data.fontes.length === 0) {
    return '_Nenhuma fonte vinculada._\n';
  }

  return data.fontes
    .map((fonte, index) => {
      const meta = JSON.stringify(fonte.metadados_json, null, 2);
      const conteudo = fonte.conteudo_texto?.trim()
        ? `\n\n<details>\n<summary>Conteúdo (trecho)</summary>\n\n${fonte.conteudo_texto.slice(0, 8000)}\n\n</details>\n`
        : '';

      return `### ${index + 1}. ${fonte.titulo}

- **ID:** \`${fonte.id}\`
- **Origem:** ${fonte.tipo_origem}
- **Ativa:** ${fonte.ativa ? 'sim' : 'não'}
- **Checksum:** ${fonte.checksum ?? 'N/A'}
- **Ingestão:** ${formatIso(fonte.data_ingestao)}
- **Metadados:**

\`\`\`json
${meta}
\`\`\`
${conteudo}`;
    })
    .join('\n\n');
}

function renderConversasSection(data: NotebookExportData): string {
  if (data.conversas.length === 0) {
    return '_Nenhuma conversa registrada._\n';
  }

  return data.conversas
    .map((conversa) => {
      const titulo = conversa.titulo ?? 'Conversa sem título';
      const mensagens = conversa.mensagens
        .map((mensagem) => {
          const roleLabel =
            mensagem.role === 'user'
              ? 'Usuário'
              : mensagem.role === 'assistant'
                ? 'Assistente (IA)'
                : 'Sistema';

          return `#### ${roleLabel} — ${formatIso(mensagem.data_criacao)}

${mensagem.conteudo}
`;
        })
        .join('\n');

      return `### ${titulo}

- **ID:** \`${conversa.id}\`
- **Criada:** ${formatIso(conversa.data_criacao)}
- **Última interação:** ${formatIso(conversa.data_ultima_interacao)}

${mensagens}`;
    })
    .join('\n\n---\n\n');
}

function renderSintesesSection(data: NotebookExportData): string {
  const sinteses = data.conversas.flatMap((conversa) =>
    conversa.mensagens
      .filter((mensagem) => mensagem.role === 'assistant')
      .map((mensagem) => ({
        conversa_titulo: conversa.titulo ?? conversa.id,
        ...mensagem,
      })),
  );

  if (sinteses.length === 0) {
    return '_Nenhuma síntese/resposta gerada por IA._\n';
  }

  return sinteses
    .map(
      (item, index) => `### Síntese ${index + 1} — ${item.conversa_titulo}

_Gerada em ${formatIso(item.data_criacao)}_

${item.conteudo}
`,
    )
    .join('\n\n---\n\n');
}

export function renderNotebookMarkdown(
  data: NotebookExportData,
  traceability: NotebookExportTraceability,
): string {
  const frontmatter = `---
sei-perceptio-export: "1.0"
notebook_id: "${traceability.notebook_id}"
notebook_nome: "${yamlEscape(traceability.notebook_nome)}"
orgao_id: "${traceability.orgao_id}"
exportado_em: "${traceability.exportado_em}"
exportado_por_id: "${traceability.exportado_por_id}"
exportado_por_nome: "${yamlEscape(traceability.exportado_por_nome)}"
formato: "${traceability.formato}"
fontes_total: ${traceability.fontes_total}
conversas_total: ${traceability.conversas_total}
mensagens_total: ${traceability.mensagens_total}
contem_sigiloso: ${traceability.contem_sigiloso}
checksum_sha256: "${traceability.checksum_sha256}"
ia_declaration: "${yamlEscape(traceability.ia_declaration)}"
---

# Exportação — ${data.notebook.nome}

> **Rastreabilidade (RF-033):** exportação gerada em ${formatIso(traceability.exportado_em)} por **${traceability.exportado_por_nome}** (\`${traceability.exportado_por_id}\`). Checksum SHA-256 do corpo: \`${traceability.checksum_sha256}\`.

${data.notebook.descricao ? `_${data.notebook.descricao}_\n` : ''}

## Metadados do notebook

| Campo | Valor |
|-------|-------|
| ID | \`${data.notebook.id}\` |
| Criado em | ${formatIso(data.notebook.created_at)} |
| Atualizado em | ${formatIso(data.notebook.updated_at)} |
| Contém sigiloso | ${data.contem_sigiloso ? 'Sim' : 'Não'} |

## Fontes originais

${renderFonteSection(data)}

## Histórico de conversas

${renderConversasSection(data)}

## Sínteses geradas (respostas IA)

${renderSintesesSection(data)}

---

${AI_SEAL_MARKDOWN}

_${IA_DECLARATION}_
`;

  return frontmatter;
}

import PDFDocument from 'pdfkit';

import { IA_DECLARATION } from '@/lib/rag/prompts/system';
import type { NotebookExportTraceability } from '@/types/notebook-share';

import type { NotebookExportData } from '@/lib/notebook/export-builder';

function stripMarkdown(text: string): string {
  return text
    .replace(/[#>*_`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapText(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  options?: { indent?: number },
) {
  const indent = options?.indent ?? 0;
  doc.text(stripMarkdown(text), {
    indent,
    align: 'left',
    lineGap: 2,
  });
}

export async function renderNotebookPdf(
  data: NotebookExportData,
  traceability: NotebookExportTraceability,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);

    doc.fontSize(18).text(`Exportação — ${data.notebook.nome}`, { underline: true });
    doc.moveDown();

    doc.fontSize(10).fillColor('#444444');
    doc.text(`Rastreabilidade (RF-033)`);
    doc.text(`Exportado em: ${traceability.exportado_em}`);
    doc.text(`Exportado por: ${traceability.exportado_por_nome} (${traceability.exportado_por_id})`);
    doc.text(`Notebook ID: ${traceability.notebook_id}`);
    doc.text(`Checksum SHA-256: ${traceability.checksum_sha256}`);
    doc.text(`Fontes: ${traceability.fontes_total} | Conversas: ${traceability.conversas_total}`);
    doc.text(`Contém sigiloso: ${traceability.contem_sigiloso ? 'Sim' : 'Não'}`);
    doc.moveDown();

    doc.fillColor('#000000').fontSize(14).text('Fontes originais');
    doc.moveDown(0.5);
    doc.fontSize(10);

    if (data.fontes.length === 0) {
      doc.text('Nenhuma fonte vinculada.');
    } else {
      for (const [index, fonte] of data.fontes.entries()) {
        doc.text(`${index + 1}. ${fonte.titulo}`);
        doc.text(`   Origem: ${fonte.tipo_origem} | Checksum: ${fonte.checksum ?? 'N/A'}`);
        if (fonte.conteudo_texto) {
          wrapText(doc, fonte.conteudo_texto.slice(0, 2000), { indent: 12 });
        }
        doc.moveDown(0.5);
      }
    }

    doc.addPage();
    doc.fontSize(14).text('Histórico de conversas');
    doc.moveDown(0.5);
    doc.fontSize(10);

    for (const conversa of data.conversas) {
      doc.text(conversa.titulo ?? conversa.id, { underline: true });
      for (const mensagem of conversa.mensagens) {
        const label =
          mensagem.role === 'user'
            ? 'Usuário'
            : mensagem.role === 'assistant'
              ? 'Assistente (IA)'
              : 'Sistema';
        doc.text(`${label} — ${mensagem.data_criacao}`);
        wrapText(doc, mensagem.conteudo.slice(0, 4000));
        doc.moveDown(0.5);
      }
      doc.moveDown();
    }

    doc.addPage();
    doc.fontSize(14).text('Sínteses geradas (respostas IA)');
    doc.moveDown(0.5);
    doc.fontSize(10);

    const sinteses = data.conversas.flatMap((conversa) =>
      conversa.mensagens.filter((mensagem) => mensagem.role === 'assistant'),
    );

    if (sinteses.length === 0) {
      doc.text('Nenhuma síntese registrada.');
    } else {
      for (const [index, mensagem] of sinteses.entries()) {
        doc.text(`Síntese ${index + 1}`, { underline: true });
        wrapText(doc, mensagem.conteudo.slice(0, 6000));
        doc.moveDown();
      }
    }

    doc.moveDown();
    doc.fontSize(9).fillColor('#666666').text(IA_DECLARATION, { align: 'left' });

    doc.end();
  });
}

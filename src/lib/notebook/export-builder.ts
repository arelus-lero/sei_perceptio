import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { IA_DECLARATION } from '@/lib/rag/prompts/system';
import type { NotebookExportFormat, NotebookExportTraceability } from '@/types/notebook-share';

export interface ExportFonte {
  id: string;
  titulo: string;
  tipo_origem: string;
  ativa: boolean;
  checksum: string | null;
  data_ingestao: string;
  metadados_json: Record<string, unknown>;
  conteudo_texto: string | null;
  documento_sei_id: string | null;
}

export interface ExportMensagem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  conteudo: string;
  data_criacao: string;
  chunks_citados: unknown[];
}

export interface ExportConversa {
  id: string;
  titulo: string | null;
  data_criacao: string;
  data_ultima_interacao: string;
  mensagens: ExportMensagem[];
}

export interface NotebookExportData {
  notebook: {
    id: string;
    nome: string;
    descricao: string | null;
    created_at: string;
    updated_at: string;
  };
  fontes: ExportFonte[];
  conversas: ExportConversa[];
  exportado_por: {
    id: string;
    nome: string;
  };
  orgao_id: string;
  contem_sigiloso: boolean;
}

export async function loadNotebookExportData(
  supabase: SupabaseClient,
  notebookId: string,
  orgaoId: string,
  exportadoPor: { id: string; nome: string },
  contemSigiloso: boolean,
): Promise<NotebookExportData> {
  const { data: notebook, error: notebookError } = await supabase
    .from('notebook')
    .select('id, nome, descricao, created_at, updated_at')
    .eq('id', notebookId)
    .eq('orgao_id', orgaoId)
    .single();

  if (notebookError || !notebook) {
    throw new Error('Notebook not found');
  }

  const { data: fontes, error: fontesError } = await supabase
    .from('fonte')
    .select(
      'id, titulo, tipo_origem, ativa, checksum, data_ingestao, metadados_json, conteudo_texto, documento_sei_id',
    )
    .eq('notebook_id', notebookId)
    .eq('orgao_id', orgaoId)
    .order('created_at', { ascending: true });

  if (fontesError) {
    throw new Error(fontesError.message);
  }

  const { data: conversas, error: conversasError } = await supabase
    .from('conversa')
    .select('id, titulo, data_criacao, data_ultima_interacao')
    .eq('notebook_id', notebookId)
    .eq('orgao_id', orgaoId)
    .order('data_criacao', { ascending: true });

  if (conversasError) {
    throw new Error(conversasError.message);
  }

  const conversaIds = (conversas ?? []).map((conversa) => conversa.id);
  const mensagensByConversa = new Map<string, ExportMensagem[]>();

  if (conversaIds.length > 0) {
    const { data: mensagens, error: mensagensError } = await supabase
      .from('mensagem')
      .select('id, conversa_id, role, conteudo, data_criacao, chunks_citados')
      .eq('orgao_id', orgaoId)
      .in('conversa_id', conversaIds)
      .order('data_criacao', { ascending: true });

    if (mensagensError) {
      throw new Error(mensagensError.message);
    }

    for (const mensagem of mensagens ?? []) {
      const list = mensagensByConversa.get(mensagem.conversa_id) ?? [];
      list.push({
        id: mensagem.id,
        role: mensagem.role,
        conteudo: mensagem.conteudo,
        data_criacao: mensagem.data_criacao,
        chunks_citados: mensagem.chunks_citados ?? [],
      });
      mensagensByConversa.set(mensagem.conversa_id, list);
    }
  }

  return {
    notebook: {
      id: notebook.id,
      nome: notebook.nome,
      descricao: notebook.descricao,
      created_at: notebook.created_at,
      updated_at: notebook.updated_at,
    },
    fontes: (fontes ?? []).map((fonte) => ({
      id: fonte.id,
      titulo: fonte.titulo,
      tipo_origem: fonte.tipo_origem,
      ativa: fonte.ativa,
      checksum: fonte.checksum,
      data_ingestao: fonte.data_ingestao,
      metadados_json: (fonte.metadados_json ?? {}) as Record<string, unknown>,
      conteudo_texto: fonte.conteudo_texto,
      documento_sei_id: fonte.documento_sei_id,
    })),
    conversas: (conversas ?? []).map((conversa) => ({
      id: conversa.id,
      titulo: conversa.titulo,
      data_criacao: conversa.data_criacao,
      data_ultima_interacao: conversa.data_ultima_interacao,
      mensagens: mensagensByConversa.get(conversa.id) ?? [],
    })),
    exportado_por: exportadoPor,
    orgao_id: orgaoId,
    contem_sigiloso: contemSigiloso,
  };
}

export function buildExportTraceability(
  data: NotebookExportData,
  formato: NotebookExportFormat,
  bodyChecksum: string,
): NotebookExportTraceability {
  const mensagensTotal = data.conversas.reduce(
    (acc, conversa) => acc + conversa.mensagens.length,
    0,
  );

  return {
    versao: '1.0',
    notebook_id: data.notebook.id,
    notebook_nome: data.notebook.nome,
    orgao_id: data.orgao_id,
    exportado_em: new Date().toISOString(),
    exportado_por_id: data.exportado_por.id,
    exportado_por_nome: data.exportado_por.nome,
    formato,
    fontes_total: data.fontes.length,
    conversas_total: data.conversas.length,
    mensagens_total: mensagensTotal,
    contem_sigiloso: data.contem_sigiloso,
    ia_declaration: IA_DECLARATION,
    checksum_sha256: bodyChecksum,
  };
}

export function sha256Content(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

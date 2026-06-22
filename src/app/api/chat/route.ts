import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import type { ChunkCitado, IndicadorConfiancaEntry } from '@/lib/db/schema';
import { logAuditSafe } from '@/lib/governance/audit-log';
import { getRouteLogger, logError, withRequestIdHeader } from '@/lib/logger';
import { assertNotebookAccess } from '@/lib/notebook/access';
import { getPromptTemplate, isPromptTemplateId } from '@/lib/prompts/templates';
import { streamAssistantResponse } from '@/lib/rag/chat-stream';
import {
  createChatPipelineDeadline,
  getChatPipelineTimeoutMs,
  isChatPipelineTimeoutError,
  withPipelineTimeout,
} from '@/lib/rag/chat-pipeline-timeout';
import { IA_DECLARATION, AI_SEAL_MARKDOWN, NO_SOURCES_RESPONSE } from '@/lib/rag/prompts/system';
import { retrieveChunks } from '@/lib/rag/retrieval';
import { sanitizeUserPrompt } from '@/lib/security/prompt-sanitizer';
import type { ConversationTurn, RetrievedChunk } from '@/lib/rag/types';
import { verifyResponseClaims } from '@/lib/rag/verification';
import { createServerClient } from '@/lib/supabase/server';

const ChatRequestSchema = z.object({
  notebook_id: z.uuid(),
  conversa_id: z.uuid().nullable(),
  mensagem: z.string().min(1).max(5000),
  template_id: z.string().optional(),
  fontes_ativas: z.array(z.uuid()).optional(),
  filtros: z
    .object({
      tipo_documento: z.array(z.string()).optional(),
      unidade: z.array(z.string()).optional(),
      data_inicio: z.iso.date().optional(),
      data_fim: z.iso.date().optional(),
      nup: z.string().optional(),
      interessado: z.string().trim().min(1).max(200).optional(),
      tags: z.array(z.uuid()).optional(),
    })
    .optional(),
});

function encodeSseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function mapChunkToCitation(chunk: RetrievedChunk) {
  return {
    type: 'citation' as const,
    source_id: chunk.fonte_id,
    chunk_id: chunk.id,
    numero_sei: chunk.numero_sei ?? String(chunk.metadados_json.numero_sei ?? 'N/A'),
    tipo: chunk.tipo_documento ?? String(chunk.metadados_json.tipo_documento ?? 'N/A'),
    unidade: chunk.unidade_geradora ?? String(chunk.metadados_json.unidade_geradora ?? 'N/A'),
    trecho: chunk.conteudo.slice(0, 500),
    score: chunk.score_rrf,
  };
}

function buildChunksCitados(chunks: RetrievedChunk[]): ChunkCitado[] {
  return chunks.map((chunk) => ({
    chunk_id: chunk.id,
    fonte_id: chunk.fonte_id,
    score: chunk.score_rrf,
  }));
}

function buildIndicadorConfianca(
  items: Awaited<ReturnType<typeof verifyResponseClaims>>,
): Record<string, IndicadorConfiancaEntry> {
  return Object.fromEntries(
    items.map((item, index) => [
      `claim_${index}`,
      {
        afirmacao: item.afirmacao,
        nivel: item.nivel,
        chunk_id_referencia: item.chunk_id_referencia ?? undefined,
      },
    ]),
  );
}

export async function POST(request: NextRequest) {
  const { requestId, log } = getRouteLogger(request, 'POST /api/chat');

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgaoId = request.headers.get('x-orgao-id');
    if (!orgaoId) {
      return NextResponse.json({ error: 'Missing orgao context' }, { status: 400 });
    }

    const body = await request.json();
    const validated = ChatRequestSchema.parse(body);

    if (validated.template_id && !isPromptTemplateId(validated.template_id)) {
      return NextResponse.json({ error: 'Invalid template_id' }, { status: 400 });
    }

    const templateId = validated.template_id;
    const appliedTemplate =
      templateId && isPromptTemplateId(templateId)
        ? getPromptTemplate(templateId)
        : undefined;
    const systemPromptOverride = appliedTemplate
      ? `[${appliedTemplate.label}] ${appliedTemplate.description}`
      : undefined;

    const sanitizedPrompt = sanitizeUserPrompt(validated.mensagem);

    if (sanitizedPrompt.flagged) {
      log.warn(
        {
          event: 'prompt_injection_detected',
          flagged: true,
          reasons: sanitizedPrompt.reasons,
          orgao_id: orgaoId,
          user_id: user.id,
          notebook_id: validated.notebook_id,
          original_length: validated.mensagem.length,
          sanitized_length: sanitizedPrompt.clean.length,
        },
        'Prompt injection patterns detected',
      );
    }

    const access = await assertNotebookAccess({
      supabase,
      notebookId: validated.notebook_id,
      orgaoId,
      userId: user.id,
      userRole:
        request.headers.get('x-user-role') === 'admin'
          ? 'admin'
          : request.headers.get('x-user-role') === 'analista'
            ? 'analista'
            : 'consultor',
      require: 'read',
    });

    if (!access) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    const { data: notebook, error: notebookError } = await supabase
      .from('notebook')
      .select('id, orgao_id, nome')
      .eq('id', validated.notebook_id)
      .eq('orgao_id', orgaoId)
      .single();

    if (notebookError || !notebook) {
      return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });
    }

    let conversaId = validated.conversa_id;

    if (conversaId) {
      const { data: existingConversa, error: conversaError } = await supabase
        .from('conversa')
        .select('id')
        .eq('id', conversaId)
        .eq('notebook_id', validated.notebook_id)
        .eq('usuario_id', user.id)
        .eq('orgao_id', orgaoId)
        .single();

      if (conversaError || !existingConversa) {
        return NextResponse.json({ error: 'Conversa not found' }, { status: 404 });
      }
    } else {
      const { data: newConversa, error: createConversaError } = await supabase
        .from('conversa')
        .insert({
          notebook_id: validated.notebook_id,
          usuario_id: user.id,
          orgao_id: orgaoId,
          titulo: sanitizedPrompt.clean.slice(0, 120),
        })
        .select('id')
        .single();

      if (createConversaError || !newConversa) {
        return NextResponse.json(
          { error: 'Failed to create conversa' },
          { status: 500 },
        );
      }

      conversaId = newConversa.id;
    }

    const activeConversaId = conversaId;

    const { error: userMessageError } = await supabase.from('mensagem').insert({
      conversa_id: activeConversaId,
      role: 'user',
      conteudo: sanitizedPrompt.clean,
      orgao_id: orgaoId,
    });

    if (userMessageError) {
      return NextResponse.json(
        { error: 'Failed to save user message' },
        { status: 500 },
      );
    }

    const { data: historyRows } = await supabase
      .from('mensagem')
      .select('role, conteudo')
      .eq('conversa_id', activeConversaId)
      .order('data_criacao', { ascending: true })
      .limit(40);

    const history: ConversationTurn[] = (historyRows ?? [])
      .slice(0, -1)
      .filter(
        (row): row is ConversationTurn =>
          row.role === 'user' || row.role === 'assistant' || row.role === 'system',
      );

    const pipelineDeadline = createChatPipelineDeadline();

    let retrievedChunks;
    try {
      retrievedChunks = await withPipelineTimeout(
        retrieveChunks(supabase, {
          query: sanitizedPrompt.clean,
          notebookId: validated.notebook_id,
          fontesAtivas: validated.fontes_ativas,
          filtros: validated.filtros,
          getRemainingMs: pipelineDeadline.remainingMs,
        }),
        pipelineDeadline.remainingMs,
        'retrieval',
      );
    } catch (error) {
      if (isChatPipelineTimeoutError(error)) {
        return withRequestIdHeader(
          NextResponse.json(
            {
              error: `Tempo limite de ${getChatPipelineTimeoutMs()}ms excedido na recuperação de fontes.`,
              code: 'CHAT_TIMEOUT',
              stage: error.stage,
            },
            { status: 504 },
          ),
          requestId,
        );
      }
      throw error;
    }

    if (retrievedChunks.length === 0) {
      const noSourcesMessage = `${NO_SOURCES_RESPONSE}\n\n${AI_SEAL_MARKDOWN}`;
      const confidenceItems = [
        {
          afirmacao: 'Nenhuma fonte recuperada para fundamentar a resposta.',
          nivel: 'baixo' as const,
          chunk_id_referencia: null,
        },
      ];

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(encodeSseEvent({ type: 'token', content: noSourcesMessage })),
          );
          controller.enqueue(
            encoder.encode(
              encodeSseEvent({
                type: 'confidence',
                afirmacao: confidenceItems[0]?.afirmacao,
                nivel: confidenceItems[0]?.nivel,
              }),
            ),
          );

          const { error: assistantMessageError } = await supabase.from('mensagem').insert({
            conversa_id: activeConversaId,
            role: 'assistant',
            conteudo: noSourcesMessage,
            chunks_citados: [],
            indicador_confianca: buildIndicadorConfianca(confidenceItems),
            orgao_id: orgaoId,
          });

          if (assistantMessageError) {
            controller.enqueue(
              encoder.encode(
                encodeSseEvent({ type: 'error', message: assistantMessageError.message }),
              ),
            );
            controller.close();
            return;
          }

          await supabase
            .from('conversa')
            .update({ data_ultima_interacao: new Date().toISOString() })
            .eq('id', activeConversaId);

          await logAuditSafe({
            supabase,
            orgaoId,
            usuarioId: user.id,
            acao: 'consulta',
            entidadeTipo: 'conversa',
            entidadeId: activeConversaId,
            detalhes: {
              notebook_id: validated.notebook_id,
              pergunta: sanitizedPrompt.clean,
              template_id: appliedTemplate?.id ?? null,
              template_label: appliedTemplate?.label ?? null,
              template_applied: false,
              prompt_flagged: sanitizedPrompt.flagged,
              fontes_ativas: validated.fontes_ativas ?? [],
              chunks_recuperados: 0,
              resposta_preview: noSourcesMessage.slice(0, 500),
              degraded_mode: false,
              no_sources: true,
            },
            request,
          });

          controller.enqueue(
            encoder.encode(
              encodeSseEvent({ type: 'done', conversa_id: activeConversaId, degraded: false }),
            ),
          );
          controller.close();
        },
      });

      return withRequestIdHeader(
        new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-IA-Declaration': IA_DECLARATION,
          },
        }),
        requestId,
      );
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();

        const enqueueEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(encodeSseEvent(payload)));
        };

        try {
          let assistantContent = '';
          let degradedMode = false;

          const assistantResult = await streamAssistantResponse(
            {
              chunks: retrievedChunks,
              history,
              userMessage: sanitizedPrompt.clean,
              systemPromptOverride,
              deadline: pipelineDeadline,
            },
            (token) => {
              assistantContent += token;
              enqueueEvent({ type: 'token', content: token });
            },
            log,
          );

          assistantContent = assistantResult.content;
          degradedMode = assistantResult.degraded;

          if (degradedMode) {
            enqueueEvent({ type: 'degraded', message: assistantContent.slice(0, 120) });
          }

          for (const chunk of retrievedChunks) {
            enqueueEvent(mapChunkToCitation(chunk));
          }

          const confidenceItems = degradedMode
            ? []
            : await withPipelineTimeout(
                verifyResponseClaims({
                  resposta: assistantContent,
                  chunks: retrievedChunks,
                  getRemainingMs: pipelineDeadline.remainingMs,
                }),
                pipelineDeadline.remainingMs,
                'verification',
              );

          for (const item of confidenceItems) {
            enqueueEvent({
              type: 'confidence',
              afirmacao: item.afirmacao,
              nivel: item.nivel,
            });
          }

          const { error: assistantMessageError } = await supabase
            .from('mensagem')
            .insert({
              conversa_id: activeConversaId,
              role: 'assistant',
              conteudo: assistantContent,
              chunks_citados: buildChunksCitados(retrievedChunks),
              indicador_confianca: buildIndicadorConfianca(confidenceItems),
              orgao_id: orgaoId,
            });

          if (assistantMessageError) {
            throw new Error(assistantMessageError.message);
          }

          await supabase
            .from('conversa')
            .update({ data_ultima_interacao: new Date().toISOString() })
            .eq('id', activeConversaId);

          await logAuditSafe({
            supabase,
            orgaoId,
            usuarioId: user.id,
            acao: 'consulta',
            entidadeTipo: 'conversa',
            entidadeId: activeConversaId,
            detalhes: {
              notebook_id: validated.notebook_id,
              pergunta: sanitizedPrompt.clean,
              template_id: appliedTemplate?.id ?? null,
              template_label: appliedTemplate?.label ?? null,
              template_applied: Boolean(systemPromptOverride) && !degradedMode,
              prompt_flagged: sanitizedPrompt.flagged,
              prompt_flag_reasons: sanitizedPrompt.flagged
                ? sanitizedPrompt.reasons
                : undefined,
              fontes_ativas: validated.fontes_ativas ?? [],
              chunks_recuperados: retrievedChunks.length,
              resposta_preview: assistantContent.slice(0, 500),
              degraded_mode: degradedMode,
            },
            request,
          });

          enqueueEvent({
            type: 'done',
            conversa_id: activeConversaId,
            degraded: degradedMode,
          });
          controller.close();
        } catch (error) {
          if (isChatPipelineTimeoutError(error)) {
            log.warn(
              {
                event: 'chat_pipeline_timeout',
                stage: error.stage,
                timeout_ms: error.timeoutMs,
                conversa_id: activeConversaId,
              },
              'Chat pipeline timeout',
            );
            enqueueEvent({
              type: 'error',
              message: `Tempo limite de ${getChatPipelineTimeoutMs()}ms excedido (${error.stage}).`,
            });
            controller.close();
            return;
          }

          logError(log, 'Chat stream error', error, { conversa_id: activeConversaId });
          const message = error instanceof Error ? error.message : 'Internal server error';
          enqueueEvent({ type: 'error', message });
          controller.close();
        }
      },
    });

    return withRequestIdHeader(
      new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-IA-Declaration': IA_DECLARATION,
        },
      }),
      requestId,
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withRequestIdHeader(
        NextResponse.json({ error: error.issues }, { status: 400 }),
        requestId,
      );
    }

    logError(log, 'Chat API error', error);
    return withRequestIdHeader(
      NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }),
      requestId,
    );
  }
}

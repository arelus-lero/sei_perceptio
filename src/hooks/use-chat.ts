'use client';

import { useCallback, useState } from 'react';

import type {
  ChatCitation,
  ChatConfidence,
  ChatMessage,
  ChatRequestBody,
  ChatSseEvent,
} from '@/types/chat';

function createMessageId(): string {
  return crypto.randomUUID();
}

function parseSseBuffer(buffer: string): {
  events: ChatSseEvent[];
  remainder: string;
} {
  const events: ChatSseEvent[] = [];
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const dataLines = part
      .split('\n')
      .filter((entry) => entry.startsWith('data:'))
      .map((entry) => entry.slice(5));
    if (dataLines.length === 0) {
      continue;
    }

    const payload = dataLines.join('\n').trim();
    if (!payload) {
      continue;
    }

    try {
      events.push(JSON.parse(payload) as ChatSseEvent);
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SSE parse error]', payload.slice(0, 100));
      }
      continue;
    }
  }

  return { events, remainder };
}

interface UseChatOptions {
  notebookId: string;
}

export function useChat({ notebookId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (params: {
      mensagem: string;
      fontesAtivas: string[];
      templateId?: string;
      filtros?: ChatRequestBody['filtros'];
    }) => {
      const trimmed = params.mensagem.trim();
      // CRITICAL: isLoading previne race condition com conversaId.
      // conversaId só é atualizado pelo evento SSE 'done', que chega
      // antes de isLoading virar false (bloco finally).
      // Não remover este guard sem implementar um ref para o conversaId
      // pendente ou uma fila de mensagens.
      if (!trimmed || isLoading) {
        return;
      }

      setError(null);
      setIsLoading(true);

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: 'user',
        content: trimmed,
      };

      const assistantMessageId = createMessageId();
      const assistantPlaceholder: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        citations: [],
        confidence: [],
        streaming: true,
      };

      setMessages((current) => [...current, userMessage, assistantPlaceholder]);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notebook_id: notebookId,
            conversa_id: conversaId,
            mensagem: trimmed,
            template_id: params.templateId,
            fontes_ativas: params.fontesAtivas,
            filtros: params.filtros,
          } satisfies ChatRequestBody),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? `Erro ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Resposta sem stream.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
          }

          const { events, remainder } = parseSseBuffer(buffer);
          buffer = remainder;

          for (const event of events) {
            if (event.type === 'token') {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? { ...message, content: message.content + event.content }
                    : message,
                ),
              );
            }

            if (event.type === 'citation') {
              const citation: ChatCitation = {
                source_id: event.source_id,
                chunk_id: event.chunk_id,
                numero_sei: event.numero_sei,
                tipo: event.tipo,
                unidade: event.unidade,
                trecho: event.trecho,
                score: event.score,
              };

              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        citations: [...(message.citations ?? []), citation],
                      }
                    : message,
                ),
              );
            }

            if (event.type === 'confidence') {
              const confidence: ChatConfidence = {
                afirmacao: event.afirmacao,
                nivel: event.nivel,
              };

              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        confidence: [...(message.confidence ?? []), confidence],
                      }
                    : message,
                ),
              );
            }

            if (event.type === 'degraded') {
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? { ...message, degraded: true }
                    : message,
                ),
              );
            }

            if (event.type === 'done') {
              setConversaId(event.conversa_id);
              setMessages((current) =>
                current.map((message) =>
                  message.id === assistantMessageId
                    ? {
                        ...message,
                        streaming: false,
                        degraded: event.degraded ?? message.degraded,
                      }
                    : message,
                ),
              );
            }

            if (event.type === 'error') {
              throw new Error(event.message);
            }
          }

          if (done) {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, streaming: false }
                  : message,
              ),
            );
            break;
          }
        }
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : 'Erro ao enviar mensagem';
        setError(message);
        setMessages((current) =>
          current.filter((entry) => entry.id !== assistantMessageId),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [conversaId, isLoading, notebookId],
  );

  const loadConversation = useCallback((nextConversaId: string, history: ChatMessage[]) => {
    setConversaId(nextConversaId);
    setMessages(history);
    setError(null);
  }, []);

  const startNewConversation = useCallback(() => {
    setConversaId(null);
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    conversaId,
    isLoading,
    error,
    sendMessage,
    loadConversation,
    startNewConversation,
  };
}

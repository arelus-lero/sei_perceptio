'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, MessageSquarePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types/chat';
import type { ConversationSummary } from '@/types/notebook';

interface ConversationHistoryProps {
  notebookId: string;
  activeConversaId: string | null;
  onSelectConversation: (conversaId: string, messages: ChatMessage[]) => void;
  onStartNewConversation: () => void;
  onLoadingConversation?: (loading: boolean) => void;
  className?: string;
}

function mapStoredMessages(
  rows: Array<{ id: string; role: string; conteudo: string }>,
): ChatMessage[] {
  return rows
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.conteudo,
    }));
}

export function ConversationHistory({
  notebookId,
  activeConversaId,
  onSelectConversation,
  onStartNewConversation,
  onLoadingConversation,
  className,
}: ConversationHistoryProps) {
  const [conversas, setConversas] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingConversaId, setLoadingConversaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onLoadingConversation?.(isLoading || loadingConversaId !== null);
  }, [isLoading, loadingConversaId, onLoadingConversation]);

  const fetchConversas = useCallback(async (): Promise<
    { ok: true; conversas: ConversationSummary[] } | { ok: false; error: string }
  > => {
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/conversas`);
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Erro ${response.status}`);
      }

      const payload = (await response.json()) as { conversas: ConversationSummary[] };
      return { ok: true, conversas: payload.conversas };
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Erro ao carregar histórico';
      return { ok: false, error: message };
    }
  }, [notebookId]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      setIsLoading(true);
      setError(null);
    });

    void fetchConversas()
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.ok) {
          setConversas(result.conversas);
        } else {
          setError(result.error);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchConversas, activeConversaId]);

  async function handleSelectConversa(conversaId: string) {
    if (loadingConversaId) {
      return;
    }

    setLoadingConversaId(conversaId);
    setError(null);

    try {
      const response = await fetch(
        `/api/notebooks/${notebookId}/conversas/${conversaId}`,
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? `Erro ${response.status}`);
      }

      const payload = (await response.json()) as {
        conversa: { mensagens: Array<{ id: string; role: string; conteudo: string }> };
      };

      onSelectConversation(conversaId, mapStoredMessages(payload.conversa.mensagens));
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Erro ao carregar conversa';
      setError(message);
    } finally {
      setLoadingConversaId(null);
    }
  }

  function handleNewConversation() {
    onStartNewConversation();
  }

  return (
    <div className={cn('flex flex-col border-t', className)}>
      <div className="flex items-center justify-between gap-2 p-4 pb-2">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Histórico</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleNewConversation}>
          <MessageSquarePlus className="size-4" />
          Nova
        </Button>
      </div>

      <ScrollArea className="max-h-48 px-4 pb-4">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando conversas…</p>
        ) : conversas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma conversa anterior. Inicie uma pergunta no chat.
          </p>
        ) : (
          <ul className="space-y-2">
            {conversas.map((conversa) => {
              const label = conversa.titulo?.trim() || 'Conversa sem título';
              const updatedLabel = formatDistanceToNow(
                new Date(conversa.data_ultima_interacao),
                { addSuffix: true, locale: ptBR },
              );
              const isActive = activeConversaId === conversa.id;

              return (
                <li key={conversa.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50',
                      isActive && 'border-primary bg-primary/5',
                    )}
                    disabled={loadingConversaId === conversa.id}
                    onClick={() => void handleSelectConversa(conversa.id)}
                  >
                    <p className="line-clamp-2 font-medium">{label}</p>
                    <p className="mt-1 text-muted-foreground">
                      {conversa.mensagens_count} msg · {updatedLabel}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      {error ? (
        <p className="px-4 pb-4 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

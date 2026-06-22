'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, SendHorizontal } from 'lucide-react';

import { MessageBubble } from '@/components/chat/message-bubble';
import { ErrorBoundary } from '@/components/error/error-boundary';
import { ChatMessagesSkeleton } from '@/components/loading/chat-messages-skeleton';
import {
  buildChatRequestFiltros,
  ChatStructuredFilters,
  EMPTY_CHAT_STRUCTURED_FILTERS,
  type ChatStructuredFilterState,
} from '@/components/chat/chat-structured-filters';
import { PromptTemplateSelector } from '@/components/chat/prompt-template-selector';
import { SourceSelector } from '@/components/chat/source-selector';
import { TagFilter } from '@/components/tags/tag-filter';
import { ConversationHistory } from '@/components/notebook/conversation-history';
import { SourceUpload } from '@/components/notebook/source-upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useChat } from '@/hooks/use-chat';
import { useTags } from '@/hooks/use-tags';
import type { PromptTemplateId } from '@/lib/prompts/templates';
import { readFonteIngestionStatus } from '@/lib/ingestion/ingestion-status';
import { cn } from '@/lib/utils';
import type { NotebookFonte } from '@/types/chat';
import type { TagItem } from '@/types/tag';

interface ChatPanelProps {
  notebookId: string;
  notebookName: string;
  fontes: NotebookFonte[];
  canUpload: boolean;
  canAssignTags?: boolean;
  className?: string;
}

const PANEL_HEIGHT_CLASS =
  'lg:h-[calc(100vh-4rem)] lg:[@supports(height:100dvh)]:h-[calc(100dvh-4rem)]';

export function ChatPanel({
  notebookId,
  notebookName,
  fontes: initialFontes,
  canUpload,
  canAssignTags = false,
  className,
}: ChatPanelProps) {
  const [fontes, setFontes] = useState<NotebookFonte[]>(initialFontes);

  useEffect(() => {
    setFontes(initialFontes);
  }, [initialFontes]);

  const refreshFontes = useCallback(async () => {
    const response = await fetch(`/api/notebooks/${notebookId}/sources`);
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      fontes: Array<{
        id: string;
        titulo: string;
        ativa: boolean;
        tipo_origem: string;
        metadados_json?: Record<string, unknown>;
        tags?: TagItem[];
      }>;
    };

    setFontes(
      payload.fontes.map((fonte) => ({
        id: fonte.id,
        titulo: fonte.titulo,
        ativa: fonte.ativa,
        tipo_origem: fonte.tipo_origem,
        tags: fonte.tags,
        ingestion_status: readFonteIngestionStatus(fonte.metadados_json),
      })),
    );
  }, [notebookId]);

  const defaultActiveIds = useMemo(
    () => fontes.filter((fonte) => fonte.ativa).map((fonte) => fonte.id),
    [fontes],
  );

  const [activeSourceIds, setActiveSourceIds] = useState<string[]>(defaultActiveIds);
  const [input, setInput] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<PromptTemplateId | null>(
    null,
  );
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [chatFilterTagIds, setChatFilterTagIds] = useState<string[]>([]);
  const [structuredFilters, setStructuredFilters] = useState<ChatStructuredFilterState>(
    EMPTY_CHAT_STRUCTURED_FILTERS,
  );
  const [highlightedSourceId, setHighlightedSourceId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);

  const {
    tags: orgTags,
    loading: tagsLoading,
    error: tagsError,
    createTag,
    linkTag,
    unlinkTag,
  } = useTags();

  const {
    messages,
    conversaId,
    isLoading,
    error,
    sendMessage,
    loadConversation,
    startNewConversation,
  } = useChat({ notebookId });

  const activeRagTagIds = useMemo(() => {
    const merged = new Set([...filterTagIds, ...chatFilterTagIds]);
    return [...merged];
  }, [chatFilterTagIds, filterTagIds]);

  function handleToggleSource(sourceId: string, active: boolean) {
    setActiveSourceIds((current) => {
      if (active) {
        return current.includes(sourceId) ? current : [...current, sourceId];
      }
      return current.filter((id) => id !== sourceId);
    });
  }

  function handleToggleFilterTag(tagId: string) {
    setFilterTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  function handleToggleChatFilterTag(tagId: string) {
    setChatFilterTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  const updateFonteTags = useCallback((fonteId: string, updater: (tags: TagItem[]) => TagItem[]) => {
    setFontes((current) =>
      current.map((fonte) =>
        fonte.id === fonteId
          ? { ...fonte, tags: updater(fonte.tags ?? []) }
          : fonte,
      ),
    );
  }, []);

  const handleLinkTag = useCallback(
    async (fonteId: string, tagId: string) => {
      await linkTag(fonteId, tagId);
      const linked = orgTags.find((tag) => tag.id === tagId);
      if (linked) {
        updateFonteTags(fonteId, (tags) =>
          tags.some((tag) => tag.id === tagId) ? tags : [...tags, linked],
        );
      }
    },
    [linkTag, orgTags, updateFonteTags],
  );

  const handleUnlinkTag = useCallback(
    async (fonteId: string, tagId: string) => {
      await unlinkTag(fonteId, tagId);
      updateFonteTags(fonteId, (tags) => tags.filter((tag) => tag.id !== tagId));
    },
    [unlinkTag, updateFonteTags],
  );

  const handleCreateTag = useCallback(
    async (nome: string) => createTag({ nome }),
    [createTag],
  );

  function handleSelectSource(sourceId: string) {
    setHighlightedSourceId(sourceId);
    document.getElementById(`fonte-${sourceId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mensagem = input.trim();
    if (!mensagem) {
      return;
    }

    setInput('');
    await sendMessage({
      mensagem,
      fontesAtivas: activeSourceIds,
      templateId: selectedTemplateId ?? undefined,
      filtros: buildChatRequestFiltros(structuredFilters, activeRagTagIds),
    });
  }

  function handleTemplateSelect(payload: {
    templateId: PromptTemplateId;
    prompt: string;
  }) {
    setSelectedTemplateId(payload.templateId);
    setInput(payload.prompt);
  }

  const sourcesBody = (
    <>
      <SourceSelector
        fontes={fontes}
        activeSourceIds={activeSourceIds}
        onToggle={handleToggleSource}
        highlightedSourceId={highlightedSourceId}
        orgTags={orgTags}
        tagsLoading={tagsLoading}
        tagsError={tagsError}
        filterTagIds={filterTagIds}
        onToggleFilterTag={handleToggleFilterTag}
        canAssignTags={canAssignTags}
        onLinkTag={handleLinkTag}
        onUnlinkTag={handleUnlinkTag}
        onCreateTag={canAssignTags ? handleCreateTag : undefined}
        canReembed={canUpload}
        onReembedStarted={refreshFontes}
      />
      <SourceUpload
        notebookId={notebookId}
        canUpload={canUpload}
        onIngestionComplete={refreshFontes}
      />
      <ConversationHistory
        notebookId={notebookId}
        activeConversaId={conversaId}
        onSelectConversation={loadConversation}
        onStartNewConversation={startNewConversation}
        onLoadingConversation={setIsLoadingConversation}
      />
    </>
  );

  const messagesBody = isLoadingConversation ? (
    <ChatMessagesSkeleton />
  ) : (
    <ErrorBoundary
      title="Erro no painel de chat"
      message="Não foi possível exibir as mensagens. Tente novamente."
    >
      <ScrollArea className="min-h-0 flex-1 px-4">
        <div
          className="space-y-4 py-4"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Histórico de mensagens"
        >
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Faça uma pergunta sobre as fontes selecionadas. As respostas incluem
              citações rastreáveis e selo de IA.
            </p>
          ) : null}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSelectSource={handleSelectSource}
            />
          ))}
        </div>
      </ScrollArea>
    </ErrorBoundary>
  );

  const chatInputForm = (
    <form onSubmit={handleSubmit} className="shrink-0 border-t p-4">
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-2 space-y-2">
        <PromptTemplateSelector disabled={isLoading} onSelect={handleTemplateSelect} />
        <ChatStructuredFilters
          value={structuredFilters}
          onChange={setStructuredFilters}
          disabled={isLoading}
        />
        <TagFilter
          tags={orgTags}
          activeTagIds={chatFilterTagIds}
          onToggle={handleToggleChatFilterTag}
          loading={tagsLoading}
          error={tagsError}
          label="Tags ativas na consulta RAG"
        />
      </div>
      <div className="flex gap-2">
        <label htmlFor="chat-message-input" className="sr-only">
          Mensagem para consulta RAG
        </label>
        <Textarea
          id="chat-message-input"
          data-tour="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte sobre os documentos do notebook…"
          disabled={isLoading}
          rows={3}
        />
        <Button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          className="self-end"
          aria-label="Enviar mensagem"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <SendHorizontal aria-hidden />
          )}
          Enviar
        </Button>
      </div>
    </form>
  );

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[320px_1fr] lg:gap-4',
        PANEL_HEIGHT_CLASS,
        className,
      )}
    >
      {/* Desktop: fontes */}
      <Card className="hidden h-full min-h-0 flex-col overflow-hidden lg:flex">
        <CardHeader className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="w-fit px-0">
            <Link href="/notebooks">← Notebooks</Link>
          </Button>
          <CardTitle>Fontes</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {sourcesBody}
        </CardContent>
      </Card>

      {/* Mobile: abas Fontes / Conversa */}
      <Tabs
        defaultValue="conversa"
        className="flex min-h-0 flex-1 flex-col gap-2 lg:hidden"
      >
        <TabsList className="grid w-full grid-cols-2" aria-label="Área do notebook">
          <TabsTrigger value="fontes" className="min-h-11">Fontes</TabsTrigger>
          <TabsTrigger value="conversa" className="min-h-11">Conversa</TabsTrigger>
        </TabsList>

        <TabsContent
          value="fontes"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="space-y-2 pb-2">
              <Button asChild variant="ghost" size="sm" className="w-fit px-0">
                <Link href="/notebooks">← Notebooks</Link>
              </Button>
              <CardTitle>Fontes</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
              {sourcesBody}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="conversa"
          className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
        >
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>{notebookName}</CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
              {messagesBody}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mobile: input sempre visível */}
      <Card className="shrink-0 overflow-hidden lg:hidden">
        <CardContent className="p-0">{chatInputForm}</CardContent>
      </Card>

      {/* Desktop: chat completo */}
      <Card className="hidden h-full min-h-0 flex-col overflow-hidden lg:flex">
        <CardHeader>
          <CardTitle>{notebookName}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {messagesBody}
          {chatInputForm}
        </CardContent>
      </Card>
    </div>
  );
}

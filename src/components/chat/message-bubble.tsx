'use client';

import { CitationCard } from '@/components/chat/citation-card';
import { ConfidenceBadge } from '@/components/chat/confidence-badge';
import { MarkdownContent } from '@/components/chat/markdown-content';
import { AiBadge } from '@/components/governance/ai-badge';
import { Badge } from '@/components/ui/badge';
import { DEGRADED_MODE_WARNING } from '@/lib/rag/degraded-mode';
import { AI_SEAL_MARKDOWN } from '@/lib/rag/prompts/system';
import { cn } from '@/lib/utils';
import type { ChatCitation, ChatMessage } from '@/types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  className?: string;
  onSelectSource?: (sourceId: string) => void;
}

function stripSealMarkdown(content: string): string {
  const sealIndex = content.indexOf(AI_SEAL_MARKDOWN.slice(0, 20));
  if (sealIndex === -1) {
    return content;
  }
  return content.slice(0, sealIndex).trimEnd();
}

export function MessageBubble({
  message,
  className,
  onSelectSource,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const displayContent = isUser ? message.content : stripSealMarkdown(message.content);

  return (
    <div
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      <div
        className={cn(
          'max-w-[85%] space-y-3 rounded-xl px-4 py-3 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{displayContent}</p>
        ) : (
          <MarkdownContent content={displayContent} />
        )}

        {!isUser && message.citations && message.citations.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium opacity-80">Fontes citadas</p>
            {message.citations.map((citation: ChatCitation) => (
              <CitationCard
                key={`${citation.chunk_id}-${citation.source_id}`}
                citation={citation}
                onSelectSource={onSelectSource}
              />
            ))}
          </div>
        ) : null}

        {!isUser && message.confidence && message.confidence.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium opacity-80">Indicador de confiança</p>
            <div className="flex flex-wrap gap-2">
              {message.confidence.map((item) => (
                <ConfidenceBadge key={item.afirmacao} item={item} />
              ))}
            </div>
          </div>
        ) : null}

        {!isUser && message.degraded ? (
          <Badge variant="outline" className="border-amber-500 text-amber-700">
            {DEGRADED_MODE_WARNING}
          </Badge>
        ) : null}

        {!isUser && !message.degraded && !message.streaming ? <AiBadge /> : null}

        {message.streaming ? (
          <span className="inline-block animate-pulse text-xs opacity-70">
            Gerando resposta…
          </span>
        ) : null}
      </div>
    </div>
  );
}

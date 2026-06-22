import { streamDegradedResponse } from '@/lib/rag/degraded-mode';
import {
  ChatPipelineTimeoutError,
  resolveStageTimeoutMs,
  type ChatPipelineDeadline,
} from '@/lib/rag/chat-pipeline-timeout';
import { streamLlmResponse } from '@/lib/rag/generation';
import {
  getLlmTimeoutMs,
  getLlmTtftTimeoutMs,
  getLlmTimeoutKind,
  isLlmFailure,
  LlmTimeoutError,
  LlmTtftTimeoutError,
} from '@/lib/rag/llm-errors';
import { AI_SEAL_MARKDOWN } from '@/lib/rag/prompts/system';
import type { AppLogger } from '@/lib/logger';
import type { ConversationTurn, RetrievedChunk } from '@/lib/rag/types';

interface StreamAssistantResponseParams {
  chunks: RetrievedChunk[];
  history: ConversationTurn[];
  userMessage: string;
  systemPromptOverride?: string;
  deadline?: ChatPipelineDeadline;
  onPartial?: (partial: boolean) => void;
}

interface StreamAssistantResponseResult {
  content: string;
  degraded: boolean;
}

function ensureAiSeal(content: string): { content: string; appended: string | null } {
  if (content.includes(AI_SEAL_MARKDOWN)) {
    return { content, appended: null };
  }

  const seal = `\n\n${AI_SEAL_MARKDOWN}`;
  return { content: `${content}${seal}`, appended: seal };
}

export async function streamAssistantResponse(
  params: StreamAssistantResponseParams,
  onToken: (token: string) => void,
  log?: AppLogger,
): Promise<StreamAssistantResponseResult> {
  try {
    const streamTimeoutMs = params.deadline
      ? resolveStageTimeoutMs(params.deadline.remainingMs, getLlmTimeoutMs())
      : getLlmTimeoutMs();

    const llmStream = await streamLlmResponse(
      {
        chunks: params.chunks,
        history: params.history,
        userMessage: params.userMessage,
        systemPromptOverride: params.systemPromptOverride,
      },
      {
        streamTimeoutMs,
        ttftTimeoutMs: getLlmTtftTimeoutMs(),
        log,
      },
    );

    const reader = llmStream.getReader();
    let content = '';
    let firstTokenReceived = false;

    while (true) {
      if (params.deadline && params.deadline.remainingMs() <= 0) {
        if (!firstTokenReceived) {
          throw new ChatPipelineTimeoutError('generation', 0);
        }

        await reader.cancel();

        const sealed = ensureAiSeal(content);
        if (sealed.appended) {
          content = sealed.content;
          onToken(sealed.appended);
        }

        params.onPartial?.(true);
        log?.info(
          {
            event: 'chat_generation_partial',
            reason: 'pipeline_deadline_after_first_token',
          },
          'Using partial LLM response after pipeline deadline',
        );
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (value.length > 0) {
        firstTokenReceived = true;
        content += value;
        onToken(value);
      }
    }

    if (!firstTokenReceived) {
      throw new LlmTtftTimeoutError(getLlmTtftTimeoutMs(), getLlmTtftTimeoutMs());
    }

    return { content, degraded: false };
  } catch (error) {
    if (error instanceof ChatPipelineTimeoutError) {
      throw error;
    }

    if (!isLlmFailure(error)) {
      throw error;
    }

    log?.warn(
      {
        event: 'chat_degraded_mode',
        reason: error instanceof Error ? error.message : 'unknown',
        timeout_kind: getLlmTimeoutKind(error) ?? null,
        elapsed_ms: error instanceof LlmTimeoutError ? error.elapsedMs : null,
        timeout_ms: error instanceof LlmTimeoutError ? error.timeoutMs : null,
      },
      'LLM unavailable, using degraded retrieval mode',
    );

    const degradedStream = streamDegradedResponse(params.chunks);
    const reader = degradedStream.getReader();
    let content = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      content += value;
      onToken(value);
    }

    return { content, degraded: true };
  }
}

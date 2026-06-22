import { streamDegradedResponse } from '@/lib/rag/degraded-mode';
import {
  ChatPipelineTimeoutError,
  resolveStageTimeoutMs,
  type ChatPipelineDeadline,
} from '@/lib/rag/chat-pipeline-timeout';
import { streamLlmResponse } from '@/lib/rag/generation';
import { getLlmTimeoutMs, isLlmFailure, LlmTimeoutError } from '@/lib/rag/llm-errors';
import type { AppLogger } from '@/lib/logger';
import type { ConversationTurn, RetrievedChunk } from '@/lib/rag/types';

interface StreamAssistantResponseParams {
  chunks: RetrievedChunk[];
  history: ConversationTurn[];
  userMessage: string;
  systemPromptOverride?: string;
  deadline?: ChatPipelineDeadline;
}

interface StreamAssistantResponseResult {
  content: string;
  degraded: boolean;
}

export async function streamAssistantResponse(
  params: StreamAssistantResponseParams,
  onToken: (token: string) => void,
  log?: AppLogger,
): Promise<StreamAssistantResponseResult> {
  try {
    const llmTimeoutMs = params.deadline
      ? resolveStageTimeoutMs(params.deadline.remainingMs, getLlmTimeoutMs())
      : getLlmTimeoutMs();

    const llmStream = await streamLlmResponse(
      {
        chunks: params.chunks,
        history: params.history,
        userMessage: params.userMessage,
        systemPromptOverride: params.systemPromptOverride,
      },
      { timeoutMs: llmTimeoutMs },
    );

    const reader = llmStream.getReader();
    let content = '';
    const idleTimeoutMs = llmTimeoutMs;

    while (true) {
      if (params.deadline && params.deadline.remainingMs() <= 0) {
        throw new ChatPipelineTimeoutError('generation', 0);
      }

      const readResult = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new LlmTimeoutError(`LLM stream idle timeout after ${idleTimeoutMs}ms`));
          }, idleTimeoutMs);
        }),
      ]);

      const { done, value } = readResult;
      if (done) {
        break;
      }

      content += value;
      onToken(value);
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

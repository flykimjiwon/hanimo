import { useState, useCallback, useRef } from 'react';
import type { LanguageModelV1, ToolSet } from 'ai';
import { runAgentLoop, estimateCost } from '../../core/agent-loop.js';
import type { AgentEvent, Message, TokenUsage } from '../../core/types.js';
import type { DisplayMessage } from '../components/chat-view.js';
import { useStream } from './use-stream.js';

interface UseAgentOptions {
  model: LanguageModelV1;
  systemPrompt: string;
  tools?: ToolSet;
}

interface UsageState {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

interface UseAgentReturn {
  messages: DisplayMessage[];
  streamingText: string;
  isLoading: boolean;
  usage: UsageState;
  currentTool: string | null;
  sendMessage: (text: string) => void;
  cancelRun: () => void;
}

export function useAgent({ model, systemPrompt, tools }: UseAgentOptions): UseAgentReturn {
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageState>({
    promptTokens: 0,
    completionTokens: 0,
    totalCost: 0,
  });

  const stream = useStream();
  const conversationRef = useRef<Message[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case 'token':
          stream.append(event.content);
          break;

        case 'tool-call':
          setCurrentTool(event.toolName);
          setDisplayMessages((prev) => [
            ...prev,
            {
              role: 'tool-call' as const,
              content: `Calling ${event.toolName}`,
              toolName: event.toolName,
            },
          ]);
          break;

        case 'tool-result':
          setCurrentTool(null);
          setDisplayMessages((prev) => [
            ...prev,
            {
              role: 'tool-result' as const,
              content: event.isError ? `Error: ${event.result}` : event.result,
              toolName: event.toolName,
            },
          ]);
          break;

        case 'done':
          // Finalize: flush streaming text as assistant message
          if (event.response) {
            setDisplayMessages((prev) => [
              ...prev,
              { role: 'assistant' as const, content: event.response },
            ]);
          }
          stream.reset();
          setCurrentTool(null);

          setUsage((prev) => {
            const newPrompt = prev.promptTokens + event.usage.promptTokens;
            const newCompletion = prev.completionTokens + event.usage.completionTokens;
            const costEstimate = estimateCost(
              (model as unknown as { modelId?: string }).modelId ?? '',
              {
                promptTokens: newPrompt,
                completionTokens: newCompletion,
                totalTokens: newPrompt + newCompletion,
              },
            );
            return {
              promptTokens: newPrompt,
              completionTokens: newCompletion,
              totalCost: costEstimate.totalCost,
            };
          });
          break;

        case 'error':
          stream.reset();
          setCurrentTool(null);
          setDisplayMessages((prev) => [
            ...prev,
            {
              role: 'assistant' as const,
              content: `Error: ${event.error.message}`,
            },
          ]);
          break;
      }
    },
    [model, stream],
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (isLoading) return;

      // Add user message to display
      setDisplayMessages((prev) => [
        ...prev,
        { role: 'user' as const, content: text },
      ]);

      // Add to conversation history
      const userMessage: Message = { role: 'user', content: text };
      conversationRef.current = [...conversationRef.current, userMessage];

      setIsLoading(true);
      stream.reset();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      runAgentLoop({
        model,
        systemPrompt,
        messages: conversationRef.current,
        tools,
        onEvent: handleEvent,
        abortSignal: controller.signal,
      })
        .then((result) => {
          // Update conversation with assistant response
          if (result.response) {
            conversationRef.current = [
              ...conversationRef.current,
              { role: 'assistant', content: result.response },
            ];
          }
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') {
            setDisplayMessages((prev) => [
              ...prev,
              { role: 'assistant' as const, content: '(cancelled)' },
            ]);
          }
          // Other errors handled via event
        })
        .finally(() => {
          setIsLoading(false);
          abortControllerRef.current = null;
        });
    },
    [isLoading, model, systemPrompt, tools, handleEvent, stream],
  );

  const cancelRun = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    messages: displayMessages,
    streamingText: stream.text,
    isLoading,
    usage,
    currentTool,
    sendMessage,
    cancelRun,
  };
}

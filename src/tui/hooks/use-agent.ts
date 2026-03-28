import { useState, useCallback, useRef, useEffect } from 'react';
import type { LanguageModelV1, ToolSet } from 'ai';
import { runAgentLoop, estimateCost } from '../../core/agent-loop.js';
import type { AgentEvent, Message } from '../../core/types.js';
import type { DisplayMessage } from '../components/chat-view.js';
import { useStream } from './use-stream.js';

interface UseAgentOptions {
  model: LanguageModelV1;
  systemPrompt: string;
  tools?: ToolSet;
}

export interface UsageState {
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
}

export interface UseAgentReturn {
  messages: DisplayMessage[];
  streamingText: string;
  isLoading: boolean;
  usage: UsageState;
  currentTool: string | null;
  elapsedMs: number;
  sendMessage: (text: string) => void;
  cancelRun: () => void;
  addSystemMessage: (content: string) => void;
  clearMessages: () => void;
  loadMessages: (msgs: DisplayMessage[]) => void;
  updateModel: (newModel: LanguageModelV1) => void;
}

let nextMsgId = 0;
function msgId(): string {
  return `msg-${++nextMsgId}`;
}

function diagnoseError(error: Error): string {
  const msg = error.message ?? String(error);
  const code = (error as NodeJS.ErrnoException).code;

  if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
    return `${msg}\n  Hint: The server is not reachable. If using Ollama, run \`ollama serve\`.`;
  }
  if (msg.includes('404') || msg.includes('not found') || msg.includes('model')) {
    return `${msg}\n  Hint: Model not found. Use \`/model\` to switch to an available model.`;
  }
  if (code === 'ETIMEDOUT' || msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return `${msg}\n  Hint: Request timed out. The model may be too large or the server is slow.`;
  }
  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('api key')) {
    return `${msg}\n  Hint: Authentication failed. Check your API key configuration.`;
  }
  if (msg.includes('429') || msg.includes('rate limit')) {
    return `${msg}\n  Hint: Rate limited. Wait a moment and try again.`;
  }
  return msg;
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

  // Elapsed time tracking
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isLoading) return;
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 500);
    return () => {
      clearInterval(timer);
      startTimeRef.current = null;
      setElapsedMs(0);
    };
  }, [isLoading]);

  const stream = useStream();
  const conversationRef = useRef<Message[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stable refs for values used in callbacks — prevents stale closures
  const isLoadingRef = useRef(false);
  const streamRef = useRef(stream);
  const modelRef = useRef(model);
  const systemPromptRef = useRef(systemPrompt);
  const toolsRef = useRef(tools);

  // Keep refs in sync with latest values
  streamRef.current = stream;
  modelRef.current = model;
  systemPromptRef.current = systemPrompt;
  toolsRef.current = tools;

  // Stable event handler — never re-created, uses refs
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      switch (event.type) {
        case 'token':
          streamRef.current.append(event.content);
          break;

        case 'tool-call':
          setCurrentTool(event.toolName);
          setDisplayMessages((prev) => [
            ...prev,
            {
              id: msgId(),
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
              id: msgId(),
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
              { id: msgId(), role: 'assistant' as const, content: event.response },
            ]);
          }
          streamRef.current.reset();
          setCurrentTool(null);

          setUsage((prev) => {
            const newPrompt = prev.promptTokens + event.usage.promptTokens;
            const newCompletion = prev.completionTokens + event.usage.completionTokens;
            const modelId = (modelRef.current as unknown as { modelId?: string }).modelId ?? '';
            const costEstimate = estimateCost(modelId, {
              promptTokens: newPrompt,
              completionTokens: newCompletion,
              totalTokens: newPrompt + newCompletion,
            });
            return {
              promptTokens: newPrompt,
              completionTokens: newCompletion,
              totalCost: costEstimate.totalCost,
            };
          });
          break;

        case 'error':
          streamRef.current.reset();
          setCurrentTool(null);
          setDisplayMessages((prev) => [
            ...prev,
            {
              id: msgId(),
              role: 'assistant' as const,
              content: `Error: ${diagnoseError(event.error)}`,
            },
          ]);
          break;
      }
    },
    [], // empty deps — uses refs only, never re-created
  );

  const sendMessage = useCallback(
    (text: string) => {
      // Use ref to prevent double-sends (closure `isLoading` can be stale)
      if (isLoadingRef.current) return;

      // Add user message to display
      setDisplayMessages((prev) => [
        ...prev,
        { id: msgId(), role: 'user' as const, content: text },
      ]);

      // Add to conversation history
      const userMessage: Message = { role: 'user', content: text };
      conversationRef.current = [...conversationRef.current, userMessage];

      setIsLoading(true);
      isLoadingRef.current = true;
      streamRef.current.reset();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      runAgentLoop({
        model: modelRef.current,
        systemPrompt: systemPromptRef.current,
        messages: conversationRef.current,
        tools: toolsRef.current,
        onEvent: handleEvent,
        abortSignal: controller.signal,
      })
        .then((result) => {
          // Update conversation with full messages (includes tool calls/results)
          conversationRef.current = result.messages;
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') {
            streamRef.current.reset();
            setDisplayMessages((prev) => [
              ...prev,
              { id: msgId(), role: 'assistant' as const, content: '(cancelled)' },
            ]);
          }
          // Other errors handled via event
        })
        .finally(() => {
          setIsLoading(false);
          isLoadingRef.current = false;
          abortControllerRef.current = null;
        });
    },
    [handleEvent], // stable — handleEvent never changes
  );

  const cancelRun = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const addSystemMessage = useCallback((content: string) => {
    setDisplayMessages((prev) => [
      ...prev,
      { id: msgId(), role: 'system' as const, content },
    ]);
  }, []);

  const clearMessages = useCallback(() => {
    setDisplayMessages([]);
    conversationRef.current = [];
    streamRef.current.reset();
  }, []);

  const updateModel = useCallback((newModel: LanguageModelV1) => {
    modelRef.current = newModel;
  }, []);

  const loadMessages = useCallback((msgs: DisplayMessage[]) => {
    setDisplayMessages(msgs);
    conversationRef.current = msgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }) as Message);
    streamRef.current.reset();
  }, []);

  return {
    messages: displayMessages,
    streamingText: stream.text,
    isLoading,
    usage,
    currentTool,
    elapsedMs,
    sendMessage,
    cancelRun,
    addSystemMessage,
    clearMessages,
    loadMessages,
    updateModel,
  };
}

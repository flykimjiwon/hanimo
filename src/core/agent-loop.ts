import { streamText } from 'ai';
import type {
  AgentLoopOptions,
  AgentLoopResult,
  AgentEvent,
  TokenUsage,
  Message,
} from './types.js';

// Max messages to keep in conversation history to avoid exceeding context window.
// Keeps system + first 2 messages + last N messages.
const MAX_CONTEXT_MESSAGES = 40;

/**
 * Truncate messages to fit within context window limits.
 * Preserves the first 2 messages (initial context) and the most recent messages.
 */
function truncateMessages(messages: Message[]): Message[] {
  if (messages.length <= MAX_CONTEXT_MESSAGES) return messages;
  const head = messages.slice(0, 2);
  const tail = messages.slice(-(MAX_CONTEXT_MESSAGES - 2));
  return [...head, { role: 'system' as const, content: '[Earlier messages truncated to fit context window]' }, ...tail];
}

// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'codex-mini-latest': { input: 1.5, output: 6 },
  // Anthropic
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-20250414': { input: 0.8, output: 4 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  // Google
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  // DeepSeek
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-coder': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // Groq (free tier / pay-as-you-go)
  'qwen-qwq-32b': { input: 0.29, output: 0.39 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
  // Mistral
  'codestral-latest': { input: 0.3, output: 0.9 },
  'mistral-large-latest': { input: 2, output: 6 },
  'mistral-small-latest': { input: 0.1, output: 0.3 },
};

function estimateCost(
  modelId: string,
  usage: TokenUsage,
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = MODEL_PRICING[modelId];
  if (!pricing) {
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}

export async function runAgentLoop(
  options: AgentLoopOptions,
): Promise<AgentLoopResult> {
  const {
    model,
    systemPrompt,
    messages,
    tools,
    maxSteps = 25,
    onEvent,
    abortSignal,
  } = options;

  const emit = (event: AgentEvent): void => {
    onEvent?.(event);
  };

  const totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  let fullResponse = '';
  const updatedMessages: Message[] = [...messages];

  // Truncate if conversation is too long
  const contextMessages = truncateMessages(updatedMessages);

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: contextMessages,
      tools,
      maxSteps,
      abortSignal,
      onStepFinish(event) {
        if (event.usage) {
          totalUsage.promptTokens += event.usage.promptTokens || 0;
          totalUsage.completionTokens += event.usage.completionTokens || 0;
          totalUsage.totalTokens += event.usage.totalTokens || 0;
        }

        if (event.toolCalls && event.toolCalls.length > 0) {
          for (const call of event.toolCalls) {
            emit({
              type: 'tool-call',
              toolName: call.toolName,
              args: call.args as Record<string, unknown>,
            });
          }
        }

        if (event.toolResults && event.toolResults.length > 0) {
          for (const tr of event.toolResults) {
            const trRecord = tr as Record<string, unknown>;
            emit({
              type: 'tool-result',
              toolName: String(trRecord['toolName'] ?? 'unknown'),
              result: typeof trRecord['result'] === 'string'
                ? trRecord['result']
                : JSON.stringify(trRecord['result']),
              isError: false,
            });
          }
        }

        if (event.text) {
          fullResponse += event.text;
        }
      },
    });

    for await (const chunk of result.textStream) {
      emit({ type: 'token', content: chunk });
    }

    const finalResult = await result;
    const finalUsage = await finalResult.usage;
    if (finalUsage) {
      totalUsage.promptTokens = finalUsage.promptTokens || 0;
      totalUsage.completionTokens = finalUsage.completionTokens || 0;
      totalUsage.totalTokens = finalUsage.totalTokens || 0;
    }

    const responseText = await finalResult.text;
    if (responseText) {
      fullResponse = responseText;
    }

    // Preserve tool call/result messages from the AI SDK response
    try {
      const responseMessages = await finalResult.response;
      if (responseMessages && 'messages' in responseMessages) {
        const msgs = (responseMessages as { messages: Message[] }).messages;
        if (Array.isArray(msgs)) {
          updatedMessages.push(...msgs);
        }
      }
    } catch {
      // Fallback: just append the assistant text response
      if (fullResponse) {
        updatedMessages.push({ role: 'assistant', content: fullResponse });
      }
    }

    emit({ type: 'done', response: fullResponse, usage: totalUsage });

    return {
      response: fullResponse,
      usage: totalUsage,
      messages: updatedMessages,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Don't emit error for abort — caller handles AbortError separately
    if (err.name !== 'AbortError') {
      emit({ type: 'error', error: err });
    }
    throw err;
  }
}

export { estimateCost };

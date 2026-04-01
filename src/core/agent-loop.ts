import { streamText, generateText } from 'ai';
import type {
  AgentLoopOptions,
  AgentLoopResult,
  AgentEvent,
  TokenUsage,
  Message,
} from './types.js';

import { compactMessages } from './compaction.js';
import { getModelPricing } from '../providers/model-registry.js';
import { isEnabled } from './feature-flags.js';

// Max messages before triggering compaction
const MAX_CONTEXT_MESSAGES = 40;

/**
 * Simple synchronous truncation fallback.
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

// Module-level cache for pricing fetched from the OpenRouter registry
const registryPricingCache = new Map<string, { input: number; output: number }>();

async function warmPricingCache(modelId: string): Promise<void> {
  if (!modelId || MODEL_PRICING[modelId] || registryPricingCache.has(modelId)) return;
  const pricing = await getModelPricing(modelId);
  if (pricing) {
    registryPricingCache.set(modelId, pricing);
  }
}

function estimateCost(
  modelId: string,
  usage: TokenUsage,
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = MODEL_PRICING[modelId] ?? registryPricingCache.get(modelId);
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
    streaming = true,
  } = options;

  // Warm pricing cache for this model
  const modelId = (model as unknown as { modelId?: string }).modelId ?? '';
  warmPricingCache(modelId).catch(() => {});

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

  // Smart compaction: use LLM summary if possible, fallback to truncation
  let contextMessages: Message[];
  if (updatedMessages.length > MAX_CONTEXT_MESSAGES) {
    try {
      contextMessages = await compactMessages(model, updatedMessages, 8);
    } catch {
      contextMessages = truncateMessages(updatedMessages);
    }
  } else {
    contextMessages = updatedMessages;
  }

  // Non-streaming mode: use generateText for servers that don't support SSE
  if (!streaming) {
    try {
      let result;
      try {
        result = await generateText({
          model,
          system: systemPrompt,
          messages: contextMessages,
          tools,
          maxSteps,
          abortSignal,
        });
      } catch (toolErr) {
        // Retry without tools if server doesn't support function calling
        const msg = toolErr instanceof Error ? toolErr.message : String(toolErr);
        if (tools && (msg.includes('400') || msg.includes('Bad Request') || msg.includes('not support'))) {
          emit({ type: 'token', content: '[tools not supported by this model — running without tools]\n' });
          result = await generateText({
            model,
            system: systemPrompt,
            messages: contextMessages,
            maxSteps: 1,
            abortSignal,
          });
        } else {
          throw toolErr;
        }
      }

      fullResponse = result.text;
      emit({ type: 'token', content: fullResponse });

      if (result.usage) {
        totalUsage.promptTokens = result.usage.promptTokens || 0;
        totalUsage.completionTokens = result.usage.completionTokens || 0;
        totalUsage.totalTokens = result.usage.totalTokens || 0;
      }

      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const call of result.toolCalls) {
          emit({ type: 'tool-call', toolName: call.toolName, args: call.args as Record<string, unknown> });
        }
      }

      if (result.toolResults && result.toolResults.length > 0) {
        for (const tr of result.toolResults) {
          const trRecord = tr as Record<string, unknown>;
          emit({
            type: 'tool-result',
            toolName: String(trRecord['toolName'] ?? 'unknown'),
            result: typeof trRecord['result'] === 'string' ? trRecord['result'] : JSON.stringify(trRecord['result']),
            isError: false,
          });
        }
      }

      if (fullResponse) {
        updatedMessages.push({ role: 'assistant', content: fullResponse });
      }

      emit({ type: 'done', response: fullResponse, usage: totalUsage });
      return { response: fullResponse, usage: totalUsage, messages: updatedMessages };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (err.name !== 'AbortError') {
        emit({ type: 'error', error: err });
      }
      throw err;
    }
  }

  // Streaming mode (default)
  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: contextMessages,
      tools,
      maxSteps,
      abortSignal,
      ...(isEnabled('PROMPT_CACHE') ? {
        experimental_providerMetadata: {
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      } : {}),
      onStepFinish(event) {
        if (event.usage) {
          // Step-level usage tracked for debugging; final totals come from finalUsage
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

    // Retry without tools if server doesn't support function calling
    if (tools && err.name !== 'AbortError' &&
        (err.message.includes('400') || err.message.includes('Bad Request') || err.message.includes('not support'))) {
      emit({ type: 'token', content: '[tools not supported by this model — running without tools]\n' });
      try {
        const fallback = await generateText({
          model,
          system: systemPrompt,
          messages: contextMessages,
          maxSteps: 1,
          abortSignal,
        });
        fullResponse = fallback.text;
        emit({ type: 'token', content: fullResponse });
        if (fallback.usage) {
          totalUsage.promptTokens = fallback.usage.promptTokens || 0;
          totalUsage.completionTokens = fallback.usage.completionTokens || 0;
          totalUsage.totalTokens = fallback.usage.totalTokens || 0;
        }
        if (fullResponse) {
          updatedMessages.push({ role: 'assistant', content: fullResponse });
        }
        emit({ type: 'done', response: fullResponse, usage: totalUsage });
        return { response: fullResponse, usage: totalUsage, messages: updatedMessages };
      } catch (fallbackErr) {
        const fbErr = fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));
        emit({ type: 'error', error: fbErr });
        throw fbErr;
      }
    }

    // Don't emit error for abort — caller handles AbortError separately
    if (err.name !== 'AbortError') {
      emit({ type: 'error', error: err });
    }
    throw err;
  }
}

export { estimateCost };

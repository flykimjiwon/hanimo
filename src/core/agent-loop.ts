import { streamText } from 'ai';
import type {
  AgentLoopOptions,
  AgentLoopResult,
  AgentEvent,
  TokenUsage,
  Message,
} from './types.js';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-20250414': { input: 0.8, output: 4 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
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

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      messages: updatedMessages,
      tools,
      maxSteps,
      abortSignal,
      onStepFinish(event) {
        if (event.usage) {
          totalUsage.promptTokens += event.usage.promptTokens;
          totalUsage.completionTokens += event.usage.completionTokens;
          totalUsage.totalTokens += event.usage.totalTokens;
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
      totalUsage.promptTokens = finalUsage.promptTokens;
      totalUsage.completionTokens = finalUsage.completionTokens;
      totalUsage.totalTokens = finalUsage.totalTokens;
    }

    const responseText = await finalResult.text;
    if (responseText) {
      fullResponse = responseText;
    }

    emit({ type: 'done', response: fullResponse, usage: totalUsage });

    return {
      response: fullResponse,
      usage: totalUsage,
      messages: updatedMessages,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    emit({ type: 'error', error: err });
    throw err;
  }
}

export { estimateCost };

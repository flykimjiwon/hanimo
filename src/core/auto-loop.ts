import type { LanguageModelV1, ToolSet } from 'ai';
import { runAgentLoop } from './agent-loop.js';
import type { AgentEvent, Message } from './types.js';
import { sendNotification, bell } from '../tools/notify.js';

const AUTO_SYSTEM_SUFFIX = `

## Auto Mode
You are running in autonomous mode. After each response, you will automatically continue working.
- Use the todo tool to track your progress.
- When ALL tasks are complete and verified, respond with exactly: [AUTO_COMPLETE]
- Do NOT stop until the work is fully done and verified.
- If you are stuck or need user input, respond with exactly: [AUTO_PAUSE]`;

const MAX_ITERATIONS = 20;

export interface AutoLoopOptions {
  model: LanguageModelV1;
  systemPrompt: string;
  tools: ToolSet;
  initialMessage: string;
  maxSteps?: number;
  maxIterations?: number;
  onEvent?: (event: AgentEvent) => void;
  onIteration?: (iteration: number, response: string) => void;
  abortSignal?: AbortSignal;
}

export interface AutoLoopResult {
  iterations: number;
  completed: boolean;
  paused: boolean;
  messages: Message[];
}

export async function runAutoLoop(options: AutoLoopOptions): Promise<AutoLoopResult> {
  const {
    model,
    systemPrompt,
    tools,
    initialMessage,
    maxSteps = 25,
    maxIterations = MAX_ITERATIONS,
    onEvent,
    onIteration,
    abortSignal,
  } = options;

  const fullSystemPrompt = systemPrompt + AUTO_SYSTEM_SUFFIX;
  let messages: Message[] = [{ role: 'user', content: initialMessage }];
  let iterations = 0;
  let completed = false;
  let paused = false;

  while (iterations < maxIterations) {
    if (abortSignal?.aborted) break;

    iterations++;

    try {
      const result = await runAgentLoop({
        model,
        systemPrompt: fullSystemPrompt,
        messages,
        tools,
        maxSteps,
        onEvent,
        abortSignal,
      });

      messages = result.messages;
      const response = result.response;

      onIteration?.(iterations, response);

      // Check termination signals
      if (response.includes('[AUTO_COMPLETE]')) {
        completed = true;
        break;
      }
      if (response.includes('[AUTO_PAUSE]')) {
        paused = true;
        break;
      }

      // Continue: add a follow-up prompt
      messages.push({
        role: 'user',
        content: 'Continue working. Check your todo list and complete remaining tasks. When everything is done, respond with [AUTO_COMPLETE].',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') break;
      // On error, stop the loop
      break;
    }
  }

  // Notify user
  if (completed) {
    await sendNotification('hanimo', 'Auto mode: task completed ✓');
    bell();
  } else if (paused) {
    await sendNotification('hanimo', 'Auto mode: paused (needs input)');
    bell();
  } else {
    await sendNotification('hanimo', `Auto mode: stopped after ${iterations} iterations`);
    bell();
  }

  return { iterations, completed, paused, messages };
}

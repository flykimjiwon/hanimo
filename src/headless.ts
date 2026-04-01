import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import type { LanguageModelV1, ToolSet } from 'ai';
import { runAgentLoop } from './core/agent-loop.js';
import type { Message, AgentEvent } from './core/types.js';

interface HeadlessOptions {
  modelInstance: LanguageModelV1;
  systemPrompt: string;
  tools: ToolSet;
  maxSteps?: number;
}

interface HeadlessInput {
  type: 'prompt';
  content: string;
}

interface HeadlessOutput {
  type: 'text' | 'tool-call' | 'tool-result' | 'done' | 'error';
  data: unknown;
  timestamp: string;
}

function emit(event: HeadlessOutput): void {
  stdout.write(JSON.stringify(event) + '\n');
}

function isValidInput(obj: unknown): obj is HeadlessInput {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  return record['type'] === 'prompt' && typeof record['content'] === 'string';
}

export async function startHeadlessMode(options: HeadlessOptions): Promise<void> {
  const { modelInstance, systemPrompt, tools, maxSteps = 25 } = options;
  const messages: Message[] = [];

  const rl = createInterface({ input: stdin, terminal: false });

  const onEvent = (event: AgentEvent): void => {
    const ts = new Date().toISOString();
    switch (event.type) {
      case 'token':
        emit({ type: 'text', data: event.content, timestamp: ts });
        break;
      case 'tool-call':
        emit({ type: 'tool-call', data: { toolName: event.toolName, args: event.args }, timestamp: ts });
        break;
      case 'tool-result':
        emit({ type: 'tool-result', data: { toolName: event.toolName, result: event.result, isError: event.isError }, timestamp: ts });
        break;
      case 'done':
        emit({ type: 'done', data: { response: event.response, usage: event.usage }, timestamp: ts });
        break;
      case 'error':
        emit({ type: 'error', data: { message: event.error.message }, timestamp: ts });
        break;
    }
  };

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      emit({ type: 'error', data: { message: 'Invalid JSON input' }, timestamp: new Date().toISOString() });
      continue;
    }

    if (!isValidInput(parsed)) {
      emit({ type: 'error', data: { message: 'Expected { type: "prompt", content: "..." }' }, timestamp: new Date().toISOString() });
      continue;
    }

    messages.push({ role: 'user', content: parsed.content });

    try {
      const result = await runAgentLoop({
        model: modelInstance,
        systemPrompt,
        messages,
        tools,
        maxSteps,
        onEvent,
      });

      // Update messages with full conversation history
      messages.length = 0;
      messages.push(...result.messages);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      emit({ type: 'error', data: { message: errMsg }, timestamp: new Date().toISOString() });
      // Remove the failed user message
      messages.pop();
    }
  }
}

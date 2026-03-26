import type { CoreMessage, LanguageModelV1, ToolSet } from 'ai';

export type Message = CoreMessage;

export interface AgentConfig {
  provider: string;
  model: string;
  maxSteps: number;
  systemPrompt: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface SessionState {
  id: string;
  messages: Message[];
  usage: TokenUsage;
  cost: CostEstimate;
  startedAt: Date;
}

export type AgentEvent =
  | { type: 'token'; content: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolName: string; result: string; isError: boolean }
  | { type: 'error'; error: Error }
  | { type: 'done'; response: string; usage: TokenUsage };

export interface AgentLoopOptions {
  model: LanguageModelV1;
  systemPrompt: string;
  messages: Message[];
  tools?: ToolSet;
  maxSteps?: number;
  onEvent?: (event: AgentEvent) => void;
  abortSignal?: AbortSignal;
}

export interface AgentLoopResult {
  response: string;
  usage: TokenUsage;
  messages: Message[];
}

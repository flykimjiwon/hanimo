import type { AgentLoopResult, TokenUsage } from '../core/types.js';

export type WorkerState = 'idle' | 'working' | 'blocked' | 'done' | 'error';

export interface WorkerTask {
  id: string;
  description: string;
  files: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  result?: AgentLoopResult;
  error?: string;
}

export interface WorkerInfo {
  id: string;
  state: WorkerState;
  currentTask: WorkerTask | null;
  assignedFiles: string[];
  usage: TokenUsage;
}

export type CoordinatorEvent =
  | { type: 'task-assigned'; workerId: string; task: WorkerTask }
  | { type: 'task-completed'; workerId: string; task: WorkerTask }
  | { type: 'task-failed'; workerId: string; task: WorkerTask; error: string }
  | { type: 'conflict-detected'; file: string; workers: string[] }
  | { type: 'all-done'; results: WorkerTask[] };

export interface CoordinatorResult {
  tasks: WorkerTask[];
  totalUsage: TokenUsage;
  conflicts: Array<{ file: string; workers: string[] }>;
}

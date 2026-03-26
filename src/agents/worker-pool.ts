import { EventEmitter } from 'node:events';
import type { LanguageModelV1 } from 'ai';
import { runAgentLoop } from '../core/agent-loop.js';
import { createToolRegistry } from '../tools/registry.js';
import { FileLockManager } from './file-lock.js';
import type {
  WorkerInfo,
  WorkerTask,
  WorkerState,
  CoordinatorEvent,
} from './types.js';
import type { TokenUsage, Message } from '../core/types.js';

interface WorkerPoolOptions {
  maxWorkers: number;
  model: LanguageModelV1;
  systemPrompt: string;
}

function emptyUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export class WorkerPool extends EventEmitter<{
  event: [CoordinatorEvent];
}> {
  private workers = new Map<string, WorkerInfo>();
  private lockManager = new FileLockManager();
  private model: LanguageModelV1;
  private systemPrompt: string;
  private maxWorkers: number;
  private abortControllers = new Map<string, AbortController>();

  constructor(options: WorkerPoolOptions) {
    super();
    this.model = options.model;
    this.systemPrompt = options.systemPrompt;
    this.maxWorkers = options.maxWorkers;

    for (let i = 0; i < this.maxWorkers; i++) {
      const id = `worker-${i}`;
      this.workers.set(id, {
        id,
        state: 'idle',
        currentTask: null,
        assignedFiles: [],
        usage: emptyUsage(),
      });
    }
  }

  private setWorkerState(workerId: string, state: WorkerState): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.state = state;
    }
  }

  private addUsage(workerId: string, usage: TokenUsage): void {
    const worker = this.workers.get(workerId);
    if (worker) {
      worker.usage.promptTokens += usage.promptTokens;
      worker.usage.completionTokens += usage.completionTokens;
      worker.usage.totalTokens += usage.totalTokens;
    }
  }

  private acquireFileLocks(workerId: string, files: string[]): string[] {
    const conflicts: string[] = [];
    for (const file of files) {
      const acquired = this.lockManager.acquireLock(file, workerId);
      if (!acquired) {
        const lockInfo = this.lockManager.isLocked(file);
        if (lockInfo.owner) {
          conflicts.push(file);
          this.emit('event', {
            type: 'conflict-detected',
            file,
            workers: [workerId, lockInfo.owner],
          });
        }
      }
    }
    return conflicts;
  }

  async executeTask(workerId: string, task: WorkerTask): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    const controller = new AbortController();
    this.abortControllers.set(workerId, controller);

    worker.currentTask = task;
    worker.assignedFiles = task.files;
    this.setWorkerState(workerId, 'working');
    task.status = 'in-progress';

    this.emit('event', {
      type: 'task-assigned',
      workerId,
      task,
    });

    // Acquire file locks
    const conflicts = this.acquireFileLocks(workerId, task.files);
    if (conflicts.length > 0) {
      this.setWorkerState(workerId, 'blocked');
    }

    const fileContext = task.files.length > 0
      ? `\n\nFiles to work on:\n${task.files.map((f) => `- ${f}`).join('\n')}`
      : '';

    const lockedWarning = conflicts.length > 0
      ? `\n\nWARNING: The following files are locked by other workers: ${conflicts.join(', ')}. Avoid editing them.`
      : '';

    const messages: Message[] = [
      {
        role: 'user',
        content: `${task.description}${fileContext}${lockedWarning}`,
      },
    ];

    try {
      const tools = createToolRegistry();
      const result = await runAgentLoop({
        model: this.model,
        systemPrompt: this.systemPrompt,
        messages,
        tools,
        maxSteps: 25,
        abortSignal: controller.signal,
      });

      task.status = 'completed';
      task.result = result;
      this.addUsage(workerId, result.usage);
      this.setWorkerState(workerId, 'done');

      this.emit('event', {
        type: 'task-completed',
        workerId,
        task,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      task.status = 'failed';
      task.error = errorMsg;
      this.setWorkerState(workerId, 'error');

      this.emit('event', {
        type: 'task-failed',
        workerId,
        task,
        error: errorMsg,
      });
    } finally {
      this.lockManager.releaseAllForWorker(workerId);
      this.abortControllers.delete(workerId);
      worker.currentTask = null;
      worker.assignedFiles = [];
    }
  }

  getWorkerStatus(): WorkerInfo[] {
    return Array.from(this.workers.values());
  }

  getAvailableWorkerId(): string | null {
    for (const [id, worker] of this.workers) {
      if (worker.state === 'idle' || worker.state === 'done') {
        return id;
      }
    }
    return null;
  }

  getLockManager(): FileLockManager {
    return this.lockManager;
  }

  cancelWorker(workerId: string): void {
    const controller = this.abortControllers.get(workerId);
    if (controller) {
      controller.abort();
    }
    this.lockManager.releaseAllForWorker(workerId);
    this.setWorkerState(workerId, 'idle');

    const worker = this.workers.get(workerId);
    if (worker) {
      if (worker.currentTask) {
        worker.currentTask.status = 'failed';
        worker.currentTask.error = 'Cancelled';
      }
      worker.currentTask = null;
      worker.assignedFiles = [];
    }
  }

  cancelAll(): void {
    for (const workerId of this.workers.keys()) {
      this.cancelWorker(workerId);
    }
  }
}

import type { LanguageModelV1 } from 'ai';
import { generateText } from 'ai';
import { WorkerPool } from './worker-pool.js';
import type {
  WorkerTask,
  CoordinatorResult,
  CoordinatorEvent,
} from './types.js';
import type { TokenUsage } from '../core/types.js';

interface CoordinatorOptions {
  model: LanguageModelV1;
  maxWorkers: number;
  systemPrompt: string;
  onEvent?: (event: CoordinatorEvent) => void;
}

interface DecomposedTask {
  id: string;
  description: string;
  files: string[];
}

function emptyUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

const DECOMPOSE_PROMPT = `You are a task decomposition engine. Given a user request and project context, break it into independent sub-tasks that can be worked on in parallel by separate AI agents.

Rules:
1. Each sub-task should be self-contained and focused on specific files.
2. Minimize file overlap between tasks to avoid conflicts.
3. Each task needs a clear description of what to do.
4. List the files each task should read or modify.

Respond with ONLY a JSON array (no markdown fences, no extra text):
[
  {
    "id": "task-1",
    "description": "Description of what to do",
    "files": ["path/to/file1.ts", "path/to/file2.ts"]
  }
]

If the request is simple enough for one task, return a single-element array.`;

function parseTasksFromResponse(text: string): DecomposedTask[] {
  // Try to extract JSON array from the response
  const trimmed = text.trim();

  // Remove markdown code fences if present
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const tasks: DecomposedTask[] = [];
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        'description' in item &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).description === 'string'
      ) {
        const raw = item as Record<string, unknown>;
        const files = Array.isArray(raw.files)
          ? (raw.files as unknown[]).filter((f): f is string => typeof f === 'string')
          : [];

        tasks.push({
          id: raw.id as string,
          description: raw.description as string,
          files,
        });
      }
    }
    return tasks;
  } catch {
    return [];
  }
}

export class Coordinator {
  private pool: WorkerPool;
  private model: LanguageModelV1;
  private eventLog: CoordinatorEvent[] = [];
  private onEvent?: (event: CoordinatorEvent) => void;

  constructor(options: CoordinatorOptions) {
    this.model = options.model;
    this.onEvent = options.onEvent;

    this.pool = new WorkerPool({
      maxWorkers: options.maxWorkers,
      model: options.model,
      systemPrompt: options.systemPrompt,
    });

    this.pool.on('event', (event: CoordinatorEvent) => {
      this.eventLog.push(event);
      this.onEvent?.(event);
    });
  }

  async decompose(request: string, cwd: string): Promise<WorkerTask[]> {
    const result = await generateText({
      model: this.model,
      system: DECOMPOSE_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Working directory: ${cwd}\n\nRequest:\n${request}`,
        },
      ],
    });

    const decomposed = parseTasksFromResponse(result.text);

    // Fallback: if decomposition fails or returns nothing, create a single task
    if (decomposed.length === 0) {
      return [
        {
          id: 'task-1',
          description: request,
          files: [],
          status: 'pending',
        },
      ];
    }

    return decomposed.map((t) => ({
      id: t.id,
      description: t.description,
      files: t.files,
      status: 'pending' as const,
    }));
  }

  async execute(tasks: WorkerTask[]): Promise<CoordinatorResult> {
    const totalUsage = emptyUsage();
    const conflicts: Array<{ file: string; workers: string[] }> = [];

    // Track conflicts from events
    const conflictListener = (event: CoordinatorEvent): void => {
      if (event.type === 'conflict-detected') {
        conflicts.push({ file: event.file, workers: event.workers });
      }
    };
    this.pool.on('event', conflictListener);

    // Assign tasks to available workers and run in parallel
    const taskPromises: Promise<void>[] = [];

    for (const task of tasks) {
      const workerId = this.pool.getAvailableWorkerId();
      if (!workerId) {
        // All workers busy — wait for one to finish, then retry
        if (taskPromises.length > 0) {
          await Promise.race(taskPromises);
        }
        const retryWorkerId = this.pool.getAvailableWorkerId();
        if (retryWorkerId) {
          const promise = this.pool.executeTask(retryWorkerId, task);
          taskPromises.push(promise);
        } else {
          task.status = 'failed';
          task.error = 'No available workers';
        }
      } else {
        const promise = this.pool.executeTask(workerId, task);
        taskPromises.push(promise);
      }
    }

    // Wait for all tasks to complete
    await Promise.allSettled(taskPromises);

    this.pool.removeListener('event', conflictListener);

    // Aggregate usage from all workers
    for (const worker of this.pool.getWorkerStatus()) {
      totalUsage.promptTokens += worker.usage.promptTokens;
      totalUsage.completionTokens += worker.usage.completionTokens;
      totalUsage.totalTokens += worker.usage.totalTokens;
    }

    const doneEvent: CoordinatorEvent = {
      type: 'all-done',
      results: tasks,
    };
    this.eventLog.push(doneEvent);
    this.onEvent?.(doneEvent);

    return { tasks, totalUsage, conflicts };
  }

  getProgress(): { completed: number; total: number; active: string[] } {
    const workers = this.pool.getWorkerStatus();
    const active = workers
      .filter((w) => w.state === 'working' || w.state === 'blocked')
      .map((w) => w.id);

    let completed = 0;
    let total = 0;
    for (const event of this.eventLog) {
      if (event.type === 'task-assigned') {
        total++;
      }
      if (event.type === 'task-completed' || event.type === 'task-failed') {
        completed++;
      }
    }

    return { completed, total, active };
  }

  cancel(): void {
    this.pool.cancelAll();
  }
}

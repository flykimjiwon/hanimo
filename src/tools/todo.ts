import { tool } from 'ai';
import { z } from 'zod';

export interface TodoItem {
  id: number;
  task: string;
  status: 'pending' | 'in_progress' | 'done';
  createdAt: string;
}

// In-memory store — one per process lifetime
const todos: TodoItem[] = [];
let nextId = 1;

export const todoTool = tool({
  description:
    'Manage a task list to track your work on complex multi-step tasks. ' +
    'Actions: add (create task), update (change status), list (show all), remove (delete task).',
  parameters: z.object({
    action: z.enum(['add', 'update', 'list', 'remove']).describe('Action to perform'),
    task: z.string().optional().describe('Task description (for "add")'),
    id: z.number().optional().describe('Task ID (for "update" or "remove")'),
    status: z
      .enum(['pending', 'in_progress', 'done'])
      .optional()
      .describe('New status (for "update")'),
  }),
  execute: async ({ action, task, id, status }) => {
    switch (action) {
      case 'add': {
        if (!task) return { success: false, error: 'Task description required for "add"' };
        const item: TodoItem = {
          id: nextId++,
          task,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        todos.push(item);
        return { success: true, action: 'added', item };
      }

      case 'update': {
        if (id == null) return { success: false, error: 'Task ID required for "update"' };
        if (!status) return { success: false, error: 'Status required for "update"' };
        const found = todos.find((t) => t.id === id);
        if (!found) return { success: false, error: `Task #${id} not found` };
        found.status = status;
        return { success: true, action: 'updated', item: found };
      }

      case 'list': {
        const summary = {
          total: todos.length,
          pending: todos.filter((t) => t.status === 'pending').length,
          in_progress: todos.filter((t) => t.status === 'in_progress').length,
          done: todos.filter((t) => t.status === 'done').length,
        };
        return { success: true, action: 'list', summary, items: todos };
      }

      case 'remove': {
        if (id == null) return { success: false, error: 'Task ID required for "remove"' };
        const idx = todos.findIndex((t) => t.id === id);
        if (idx === -1) return { success: false, error: `Task #${id} not found` };
        const removed = todos.splice(idx, 1)[0];
        return { success: true, action: 'removed', item: removed };
      }

      default:
        return { success: false, error: `Unknown action: ${String(action)}` };
    }
  },
});

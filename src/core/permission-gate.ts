// Permission gate — wraps tool execute functions to require user approval for destructive operations
import type { ToolSet } from 'ai';
import { getPermissionLevel, formatApprovalPrompt } from './permission.js';

export interface PermissionHandler {
  /** Ask user for approval. Returns true if approved. */
  requestApproval(description: string): Promise<boolean>;
}

/**
 * Wrap a ToolSet so that destructive tools require user approval before execution.
 * Non-destructive (read-only) tools pass through without interruption.
 */
export function wrapToolsWithPermission(
  tools: ToolSet,
  requireApproval: boolean,
  handler: PermissionHandler,
): ToolSet {
  if (!requireApproval) return tools;

  const wrapped: Record<string, unknown> = {};

  for (const [name, toolDef] of Object.entries(tools)) {
    const original = toolDef as { execute?: (...args: unknown[]) => unknown; [k: string]: unknown };
    if (!original.execute) {
      wrapped[name] = toolDef;
      continue;
    }

    const originalExecute = original.execute.bind(original);
    const wrappedTool = { ...original };
    wrappedTool.execute = async (...args: unknown[]) => {
      const toolArgs = (args[0] ?? {}) as Record<string, unknown>;
      const level = getPermissionLevel(name, requireApproval, toolArgs);

      if (level === 'deny') {
        return `[Permission denied] Tool "${name}" is blocked by permission rules`;
      }

      if (level === 'ask') {
        const description = formatApprovalPrompt(name, toolArgs);
        const approved = await handler.requestApproval(description);
        if (!approved) {
          return `[Permission denied] User rejected: ${description}`;
        }
      }

      return originalExecute(...args);
    };

    wrapped[name] = wrappedTool;
  }

  return wrapped as ToolSet;
}

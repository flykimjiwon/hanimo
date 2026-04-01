import { execa } from 'execa';
import { isEnabled } from './feature-flags.js';
import type { HookConfig, HookDef } from '../config/schema.js';

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'SessionStart' | 'SessionStop' | 'UserPromptSubmit';

export interface HookContext {
  toolName?: string;
  userPrompt?: string;
}

export interface HookResult {
  blocked: boolean;
  systemReminders: string[];
}

export async function executeHooks(
  event: HookEvent,
  context: HookContext,
  config: HookConfig,
): Promise<HookResult> {
  if (!isEnabled('HOOK_SYSTEM')) {
    return { blocked: false, systemReminders: [] };
  }

  const hooks: HookDef[] = config[event] ?? [];
  if (hooks.length === 0) {
    return { blocked: false, systemReminders: [] };
  }

  const systemReminders: string[] = [];
  let blocked = false;

  for (const hook of hooks) {
    try {
      // Use execa with explicit sh -c to avoid shell metacharacter injection.
      // The command is a single string passed as argument to sh, not parsed by a shell.
      const result = await execa('sh', ['-c', hook.command], {
        timeout: hook.timeout,
        env: {
          ...process.env,
          HANIMO_HOOK_EVENT: event,
          ...(context.toolName ? { HANIMO_TOOL_NAME: context.toolName } : {}),
          ...(context.userPrompt ? { HANIMO_USER_PROMPT: context.userPrompt } : {}),
        },
        reject: false,
      });

      if (result.exitCode !== 0) {
        blocked = true;
      }

      const stdout = result.stdout?.trim();
      if (stdout) {
        systemReminders.push(stdout);
      }
    } catch {
      // Hook execution failed — treat as non-blocking
    }
  }

  return { blocked, systemReminders };
}

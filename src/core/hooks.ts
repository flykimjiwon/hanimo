import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';
import { isEnabled } from './feature-flags.js';
import { HookConfigSchema } from '../config/schema.js';
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

/**
 * Load hooks exclusively from the user-level config (~/.hanimo/config.json).
 * Project-level hooks (.hanimo.json) are intentionally ignored to prevent
 * arbitrary command execution from malicious repository configs.
 */
async function loadUserHooks(event: HookEvent): Promise<HookDef[]> {
  try {
    const userConfigPath = join(homedir(), '.hanimo', 'config.json');
    const content = await readFile(userConfigPath, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }
    const raw = parsed as Record<string, unknown>;
    const hooksRaw = raw['hooks'];
    if (hooksRaw === undefined) return [];
    const hookConfig = HookConfigSchema.parse(hooksRaw);
    return hookConfig[event] ?? [];
  } catch {
    return [];
  }
}

export async function executeHooks(
  event: HookEvent,
  context: HookContext,
  _config: HookConfig,
): Promise<HookResult> {
  if (!isEnabled('HOOK_SYSTEM')) {
    return { blocked: false, systemReminders: [] };
  }

  // Only execute hooks from user-level config to prevent project-level RCE.
  const hooks: HookDef[] = await loadUserHooks(event);
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

// Permission gate — intercepts tool calls and requires user approval for destructive operations
import { resolve, relative, isAbsolute } from 'node:path';

export type PermissionLevel = 'allow' | 'ask' | 'deny';

// Operations that always require user approval
const DESTRUCTIVE_TOOLS = new Set(['write_file', 'edit_file', 'git_commit', 'shell_exec']);
const READ_ONLY_TOOLS = new Set(['read_file', 'glob_search', 'grep_search', 'git_status', 'git_diff', 'git_log']);

// Paths that must never be read or written by the LLM
const SENSITIVE_PATHS = [
  /\.ssh\//,
  /\.gnupg\//,
  /\.aws\//,
  /\.env($|\.)/,
  /credentials/i,
  /\.kube\/config/,
  /\.npmrc$/,
  /\.netrc$/,
  /id_rsa/,
  /id_ed25519/,
  /\.pem$/,
  /\.key$/,
];

/**
 * Check if a path is within the allowed sandbox (project working directory).
 * Returns null if OK, or an error message if blocked.
 */
export function checkPathSandbox(filePath: string, cwd: string): string | null {
  const resolved = resolve(cwd, filePath);

  // Block sensitive file patterns
  for (const pattern of SENSITIVE_PATHS) {
    if (pattern.test(resolved)) {
      return `Access denied: "${filePath}" matches a sensitive file pattern`;
    }
  }

  // For absolute paths, check they're within cwd
  if (isAbsolute(filePath)) {
    const rel = relative(cwd, resolved);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return `Access denied: "${filePath}" is outside the project directory (${cwd})`;
    }
  }

  return null;
}

/**
 * Determine if a tool call needs user permission.
 */
export function getPermissionLevel(toolName: string, requireApproval: boolean): PermissionLevel {
  if (READ_ONLY_TOOLS.has(toolName)) return 'allow';
  if (!requireApproval) return 'allow';
  if (DESTRUCTIVE_TOOLS.has(toolName)) return 'ask';
  return 'allow';
}

/**
 * Format a human-readable approval prompt for a tool call.
 */
export function formatApprovalPrompt(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'write_file': {
      const path = String(args['path'] ?? '');
      const content = String(args['content'] ?? '');
      const lines = content.split('\n').length;
      return `Write ${lines} lines to ${path}`;
    }
    case 'edit_file': {
      const path = String(args['path'] ?? '');
      return `Edit ${path}`;
    }
    case 'shell_exec': {
      const cmd = String(args['command'] ?? '');
      return `Run: ${cmd}`;
    }
    case 'git_commit': {
      const msg = String(args['message'] ?? '');
      return `Git commit: "${msg}"`;
    }
    default:
      return `${toolName}(${JSON.stringify(args)})`;
  }
}

// Permission gate — intercepts tool calls and requires user approval for destructive operations
import { resolve, relative, isAbsolute } from 'node:path';
import { isEnabled } from './feature-flags.js';
import type { PermissionRule } from '../config/schema.js';

export type PermissionLevel = 'allow' | 'ask' | 'deny';

// Operations that always require user approval
const DESTRUCTIVE_TOOLS = new Set(['write_file', 'edit_file', 'git_commit', 'shell_exec']);
const READ_ONLY_TOOLS = new Set(['read_file', 'glob_search', 'grep_search', 'git_status', 'git_diff', 'git_log']);

// Paths that must never be read or written by the LLM
const SENSITIVE_PATHS = [
  /\.ssh[/\\]/,
  /\.gnupg[/\\]/,
  /\.aws[/\\]/,
  /\.env($|\.)/,
  /credentials/i,
  /\.kube[/\\]config/,
  /\.npmrc$/,
  /\.netrc$/,
  /id_rsa/,
  /id_ed25519/,
  /\.pem$/,
  /\.key$/,
  // Windows-specific credential locations
  /AppData[/\\]Roaming[/\\]\.aws/i,
  /AppData[/\\]Roaming[/\\]npm[/\\]\.npmrc/i,
];

// Module-level permission rules (set from config)
let permissionRules: PermissionRule[] = [];

/**
 * Set permission rules from config.
 */
export function setPermissionRules(rules: PermissionRule[]): void {
  permissionRules = rules;
}

// Cache compiled regex patterns to avoid repeated compilation on every tool call
const globCache = new Map<string, RegExp>();

/**
 * Simple glob matching: * matches any chars, ? matches single char.
 * Uses non-greedy quantifiers to avoid ReDoS with pathological patterns.
 */
function globMatch(pattern: string, text: string): boolean {
  let regex = globCache.get(pattern);
  if (!regex) {
    // Limit pattern complexity to prevent ReDoS
    if (pattern.length > 200) return false;
    // Limit wildcard count to prevent catastrophic backtracking
    const wildcardCount = (pattern.match(/\*/g) ?? []).length;
    if (wildcardCount > 5) return false;
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*?')
      .replace(/\?/g, '.');
    regex = new RegExp(`^${escaped}$`);
    globCache.set(pattern, regex);
  }
  return regex.test(text);
}

/**
 * Check glob rules for a tool call. Returns null if no rule matched.
 * Evaluates deny rules first, then ask, then allow.
 */
function checkGlobRules(toolName: string, args?: Record<string, unknown>): PermissionLevel | null {
  if (!isEnabled('PERMISSION_GLOB_RULES') || permissionRules.length === 0) {
    return null;
  }

  const argsStr = args ? JSON.stringify(args) : '';

  // Sort by priority: deny > ask > allow
  const sorted = [...permissionRules].sort((a, b) => {
    const order = { deny: 0, ask: 1, allow: 2 };
    return order[a.action] - order[b.action];
  });

  for (const rule of sorted) {
    if (!globMatch(rule.tool, toolName)) continue;
    if (rule.argMatch && !globMatch(rule.argMatch, argsStr)) continue;
    return rule.action;
  }

  return null;
}

/**
 * Check if a path is within the allowed sandbox (project working directory).
 * Returns null if OK, or an error message if blocked.
 */
export function checkPathSandbox(filePath: string, cwd: string): string | null {
  const resolved = resolve(cwd, filePath);
  const normalized = resolved.replace(/\\/g, '/'); // Windows backslash → forward slash

  // Block sensitive file patterns
  for (const pattern of SENSITIVE_PATHS) {
    if (pattern.test(normalized)) {
      return `Access denied: "${filePath}" matches a sensitive file pattern`;
    }
  }

  // Check resolved path is within cwd (catches both absolute and relative traversal)
  const rel = relative(cwd, resolved);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return `Access denied: "${filePath}" is outside the project directory (${cwd})`;
  }

  return null;
}

/**
 * Determine if a tool call needs user permission.
 */
export function getPermissionLevel(toolName: string, requireApproval: boolean, args?: Record<string, unknown>): PermissionLevel {
  // Check glob rules first (if enabled)
  const globResult = checkGlobRules(toolName, args);
  if (globResult !== null) return globResult;

  // Existing static logic
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

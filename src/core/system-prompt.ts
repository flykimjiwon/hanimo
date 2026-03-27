import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RoleDefinition } from '../roles/types.js';
import { loadGlobalInstructions } from './instructions.js';

export interface ProjectContext {
  cwd: string;
  gitBranch?: string;
  gitRemote?: string;
  platform: string;
}

/**
 * Load project instructions from `.modol.md` files.
 * Walks from CWD upward to find all .modol.md files (child overrides parent).
 */
function loadProjectInstructions(cwd: string): string {
  const parts: string[] = [];
  let dir = cwd;
  const visited = new Set<string>();

  // Walk upward collecting .modol.md files
  while (dir && !visited.has(dir)) {
    visited.add(dir);
    try {
      const content = readFileSync(join(dir, '.modol.md'), 'utf-8').trim();
      if (content) {
        const label = dir === cwd ? '(project root)' : `(${dir})`;
        parts.unshift(`${label}\n${content}`);
      }
    } catch {
      // No file at this level
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  return parts.join('\n\n---\n\n');
}

export function buildSystemPrompt(context: ProjectContext, role?: RoleDefinition): string {
  const gitInfo = [
    context.gitBranch ? `- Git branch: ${context.gitBranch}` : null,
    context.gitRemote ? `- Git remote: ${context.gitRemote}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const projectInstructions = loadProjectInstructions(context.cwd);
  const projectSection = projectInstructions
    ? `\n\n## Project Instructions (.modol.md)\n${projectInstructions}`
    : '';

  const roleSection = role
    ? `\n\n## Active Role: ${role.icon} ${role.name}\n${role.systemPrompt}`
    : '';

  const globalInstructions = loadGlobalInstructions();
  const globalSection = globalInstructions
    ? `\n\n## User Instructions\n${globalInstructions}`
    : '';

  return `You are modol, a terminal-based AI coding assistant.

## Capabilities
- Read, write, and edit files in the project directory
- Hash-anchored editing (hashline_read + hashline_edit) for verified, stale-proof edits
- Search files with glob patterns and grep content search
- Run shell commands and view output
- Use git for version control operations
- Fetch web pages and documentation (webfetch)
- Track multi-step work with a todo list (todo)
- Run multiple read operations in parallel (batch)
- Get TypeScript/ESLint diagnostics without modifying files (diagnostics)

## Guidelines
- Be concise. Avoid unnecessary explanation.
- Show diffs or previews before writing files.
- Ask for confirmation before destructive actions (deleting files, force-pushing, etc.).
- Prefer editing existing files over creating new ones.
- Never introduce security vulnerabilities (command injection, XSS, SQL injection).
- Use the simplest approach that solves the problem.

## Environment
- Working directory: ${context.cwd}
- Platform: ${context.platform}
${gitInfo}

When referencing files, use paths relative to the working directory.${globalSection}${projectSection}${roleSection}`;
}

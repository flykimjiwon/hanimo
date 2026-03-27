import type { ToolSet } from 'ai';
import { readFileTool, writeFileTool, editFileTool } from './file-ops.js';
import { gitStatusTool, gitDiffTool, gitCommitTool, gitLogTool } from './git-tools.js';
import { shellExecTool } from './shell-exec.js';
import { globSearchTool } from './glob-search.js';
import { grepSearchTool } from './grep-search.js';
import { hashReadFileTool, hashlineEditTool } from './hashline-edit.js';
import { webfetchTool } from './webfetch.js';
import { todoTool } from './todo.js';
import { batchTool } from './batch.js';
import { lspDiagnosticsTool } from './lsp-diagnostics.js';

export function createToolRegistry() {
  return {
    // Core file ops
    read_file: readFileTool,
    write_file: writeFileTool,
    edit_file: editFileTool,
    // Hash-anchored editing (verified edits)
    hashline_read: hashReadFileTool,
    hashline_edit: hashlineEditTool,
    // Search
    glob_search: globSearchTool,
    grep_search: grepSearchTool,
    // Shell & Git
    shell_exec: shellExecTool,
    git_status: gitStatusTool,
    git_diff: gitDiffTool,
    git_commit: gitCommitTool,
    git_log: gitLogTool,
    // New tools
    webfetch: webfetchTool,
    todo: todoTool,
    batch: batchTool,
    diagnostics: lspDiagnosticsTool,
  };
}

// Read-only tools for Assistant role (no write/edit/shell/git-commit)
export function createReadOnlyTools() {
  return {
    read_file: readFileTool,
    hashline_read: hashReadFileTool,
    glob_search: globSearchTool,
    grep_search: grepSearchTool,
    webfetch: webfetchTool,
    todo: todoTool,
    batch: batchTool,
    diagnostics: lspDiagnosticsTool,
  };
}

/**
 * Create a ToolSet from a list of tool names.
 * Used by the role system to build tool sets from role JSON definitions.
 */
export function createToolSetFromList(toolNames: string[]): ToolSet | undefined {
  if (toolNames.length === 0) return undefined;
  const allTools = createToolRegistry();
  const filtered: Record<string, unknown> = {};
  for (const name of toolNames) {
    const tool = allTools[name as keyof ReturnType<typeof createToolRegistry>];
    if (tool) {
      filtered[name] = tool;
    }
  }
  return Object.keys(filtered).length > 0 ? (filtered as ToolSet) : undefined;
}

/**
 * Merge multiple ToolSets into one. Later sets override earlier ones on conflict.
 */
export function mergeToolSets(...sets: Array<ToolSet | undefined>): ToolSet | undefined {
  const merged: Record<string, unknown> = {};
  for (const set of sets) {
    if (!set) continue;
    Object.assign(merged, set);
  }
  return Object.keys(merged).length > 0 ? (merged as ToolSet) : undefined;
}

export {
  readFileTool,
  writeFileTool,
  editFileTool,
  hashReadFileTool,
  hashlineEditTool,
  gitStatusTool,
  gitDiffTool,
  gitCommitTool,
  gitLogTool,
  shellExecTool,
  globSearchTool,
  grepSearchTool,
  webfetchTool,
  todoTool,
  batchTool,
  lspDiagnosticsTool,
};

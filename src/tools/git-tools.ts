import { tool } from 'ai';
import { z } from 'zod';
import { simpleGit } from 'simple-git';
import { checkPathSandbox } from '../core/permission.js';

export const gitStatusTool = tool({
  description: 'Show the working tree status (staged, modified, untracked files)',
  parameters: z.object({
    cwd: z.string().optional().describe('Working directory (defaults to process.cwd())'),
  }),
  execute: async ({ cwd }) => {
    try {
      if (cwd) {
        const sandboxErr = checkPathSandbox(cwd, process.cwd());
        if (sandboxErr) return { success: false, error: sandboxErr };
      }
      const git = simpleGit(cwd ?? process.cwd());
      const status = await git.status();
      return {
        success: true,
        branch: status.current ?? 'unknown',
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
        deleted: status.deleted,
        conflicted: status.conflicted,
        ahead: status.ahead,
        behind: status.behind,
        isClean: status.isClean(),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `git status failed: ${message}` };
    }
  },
});

export const gitDiffTool = tool({
  description: 'Show changes between working tree and index, or between commits',
  parameters: z.object({
    cwd: z.string().optional().describe('Working directory'),
    staged: z.boolean().optional().default(false).describe('Show staged changes (--cached)'),
    target: z.string().optional().describe('Diff target (branch, commit, or file path)'),
  }),
  execute: async ({ cwd, staged, target }) => {
    try {
      if (cwd) {
        const sandboxErr = checkPathSandbox(cwd, process.cwd());
        if (sandboxErr) return { success: false, error: sandboxErr };
      }
      const git = simpleGit(cwd ?? process.cwd());
      const args: string[] = [];
      if (staged) args.push('--cached');
      if (target) args.push(target);

      const diff = await git.diff(args);
      return {
        success: true,
        diff: diff || '(no changes)',
        length: diff.length,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `git diff failed: ${message}` };
    }
  },
});

export const gitCommitTool = tool({
  description: 'Stage files and create a git commit',
  parameters: z.object({
    cwd: z.string().optional().describe('Working directory'),
    message: z.string().describe('Commit message'),
    files: z.array(z.string()).optional().describe('Files to stage (defaults to all changed files)'),
  }),
  execute: async ({ cwd, message, files }) => {
    try {
      if (cwd) {
        const sandboxErr = checkPathSandbox(cwd, process.cwd());
        if (sandboxErr) return { success: false, error: sandboxErr };
      }
      const git = simpleGit(cwd ?? process.cwd());

      if (files && files.length > 0) {
        await git.add(files);
      } else {
        await git.add('-A');
      }

      const result = await git.commit(message);
      return {
        success: true,
        commit: result.commit || 'unknown',
        summary: {
          changes: result.summary.changes,
          insertions: result.summary.insertions,
          deletions: result.summary.deletions,
        },
      };
    } catch (err: unknown) {
      const message_ = err instanceof Error ? err.message : String(err);
      return { success: false, error: `git commit failed: ${message_}` };
    }
  },
});

export const gitLogTool = tool({
  description: 'Show recent commit history',
  parameters: z.object({
    cwd: z.string().optional().describe('Working directory'),
    maxCount: z.number().min(1).max(50).optional().default(10).describe('Number of commits to show'),
  }),
  execute: async ({ cwd, maxCount }) => {
    try {
      if (cwd) {
        const sandboxErr = checkPathSandbox(cwd, process.cwd());
        if (sandboxErr) return { success: false, error: sandboxErr };
      }
      const git = simpleGit(cwd ?? process.cwd());
      const log = await git.log({ maxCount });
      const commits = log.all.map((entry) => ({
        hash: entry.hash.slice(0, 8),
        date: entry.date,
        message: entry.message,
        author: entry.author_name,
      }));
      return {
        success: true,
        total: log.total,
        commits,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `git log failed: ${message}` };
    }
  },
});

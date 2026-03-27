import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { checkPathSandbox } from '../core/permission.js';
import { globby } from 'globby';

/**
 * Batch tool: run multiple read-only operations in parallel.
 * Supports: read_files (multiple), grep_multi (multiple patterns), glob_multi (multiple patterns).
 * This avoids sequential round-trips for independent queries.
 */
export const batchTool = tool({
  description:
    'Run multiple independent read-only operations in parallel for speed. ' +
    'Supports batch file reads and batch globs. ' +
    'Much faster than calling tools one by one when operations are independent.',
  parameters: z.object({
    reads: z
      .array(z.object({ path: z.string() }))
      .optional()
      .describe('Files to read in parallel'),
    globs: z
      .array(z.object({ pattern: z.string(), cwd: z.string().optional() }))
      .optional()
      .describe('Glob patterns to search in parallel'),
  }),
  execute: async ({ reads, globs }) => {
    const results: Record<string, unknown> = {};

    const promises: Array<Promise<void>> = [];

    // Batch reads
    if (reads && reads.length > 0) {
      const readResults: Array<{ path: string; content?: string; error?: string }> = [];
      for (const r of reads) {
        promises.push(
          (async () => {
            const blocked = checkPathSandbox(r.path, process.cwd());
            if (blocked) {
              readResults.push({ path: r.path, error: blocked });
              return;
            }
            try {
              const content = await readFile(r.path, 'utf-8');
              // Truncate large files
              const MAX = 20000;
              readResults.push({
                path: r.path,
                content: content.length > MAX
                  ? content.slice(0, MAX) + `\n... (truncated, ${content.length} chars total)`
                  : content,
              });
            } catch (err: unknown) {
              readResults.push({ path: r.path, error: String(err) });
            }
          })(),
        );
      }
      await Promise.all(promises.splice(0));
      results['reads'] = readResults;
    }

    // Batch globs
    if (globs && globs.length > 0) {
      const globResults: Array<{ pattern: string; files: string[] }> = [];
      for (const g of globs) {
        promises.push(
          (async () => {
            try {
              const files = await globby(g.pattern, {
                cwd: g.cwd ?? process.cwd(),
                gitignore: true,
                absolute: false,
              });
              globResults.push({ pattern: g.pattern, files: files.slice(0, 100) });
            } catch (err: unknown) {
              globResults.push({ pattern: g.pattern, files: [] });
            }
          })(),
        );
      }
      await Promise.all(promises.splice(0));
      results['globs'] = globResults;
    }

    return { success: true, results };
  },
});

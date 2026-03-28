import { tool } from 'ai';
import { z } from 'zod';
import { globby } from 'globby';
import { checkPathSandbox } from '../core/permission.js';

export const globSearchTool = tool({
  description: 'Find files matching glob patterns (e.g. "**/*.ts", "src/**/*.test.ts")',
  parameters: z.object({
    pattern: z.string().describe('Glob pattern to match files'),
    cwd: z.string().optional().describe('Base directory for search (defaults to process.cwd())'),
    ignore: z
      .array(z.string())
      .optional()
      .default(['**/node_modules/**', '**/dist/**', '**/.git/**'])
      .describe('Glob patterns to ignore'),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .default(200)
      .describe('Maximum number of results'),
  }),
  execute: async ({ pattern, cwd, ignore, limit }) => {
    try {
      if (cwd) {
        const sandboxErr = checkPathSandbox(cwd, process.cwd());
        if (sandboxErr) return { success: false, error: sandboxErr };
      }

      const files = await globby(pattern, {
        cwd: cwd ?? process.cwd(),
        ignore,
        absolute: true,
        onlyFiles: true,
        gitignore: true,
      });

      const truncated = files.length > limit;
      const results = truncated ? files.slice(0, limit) : files;

      return {
        success: true,
        totalFound: files.length,
        returned: results.length,
        truncated,
        files: results,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Glob search failed: ${message}` };
    }
  },
});

import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { globby } from 'globby';
import { checkPathSandbox } from '../core/permission.js';

export interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

async function searchFile(filePath: string, regex: RegExp, maxMatches: number): Promise<GrepMatch[]> {
  const matches: GrepMatch[] = [];

  try {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      if (regex.test(line)) {
        matches.push({ file: filePath, line: lineNum, content: line });
        if (matches.length >= maxMatches) {
          rl.close();
          break;
        }
      }
    }
  } catch {
    // Skip files that can't be read (binary, permissions, etc.)
  }

  return matches;
}

export const grepSearchTool = tool({
  description: 'Search file contents using regex patterns across a directory',
  parameters: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().optional().describe('Directory or file to search (defaults to process.cwd())'),
    glob: z
      .string()
      .optional()
      .default('**/*')
      .describe('Glob pattern to filter files (e.g. "*.ts", "**/*.tsx")'),
    ignoreCase: z.boolean().optional().default(false).describe('Case insensitive search'),
    maxResults: z
      .number()
      .min(1)
      .max(500)
      .optional()
      .default(100)
      .describe('Maximum total matches to return'),
    contextLines: z
      .number()
      .min(0)
      .max(5)
      .optional()
      .default(0)
      .describe('Lines of context around each match'),
  }),
  execute: async ({ pattern, path, glob: fileGlob, ignoreCase, maxResults, contextLines }) => {
    try {
      // No 'g' flag — avoids lastIndex state bug causing missed matches
      const flags = ignoreCase ? 'i' : '';
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, flags);
      } catch {
        return { success: false, error: `Invalid regex pattern: ${pattern}` };
      }

      if (path) {
        const sandboxErr = checkPathSandbox(path, process.cwd());
        if (sandboxErr) return { success: false, error: sandboxErr };
      }

      const basePath = path ?? process.cwd();
      const files = await globby(fileGlob, {
        cwd: basePath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/*.min.js', '**/*.map'],
        absolute: true,
        onlyFiles: true,
        gitignore: true,
      });

      const allMatches: GrepMatch[] = [];

      for (const file of files) {
        if (allMatches.length >= maxResults) break;

        const remaining = maxResults - allMatches.length;
        const fileMatches = await searchFile(file, regex, remaining);

        // If contextLines requested, read whole file and add context
        if (contextLines > 0 && fileMatches.length > 0) {
          try {
            const content = await readFile(file, 'utf-8');
            const lines = content.split(/\r?\n/);
            for (const match of fileMatches) {
              const start = Math.max(0, match.line - 1 - contextLines);
              const end = Math.min(lines.length, match.line + contextLines);
              const contextSlice = lines.slice(start, end).map((l, i) => {
                const num = start + i + 1;
                const marker = num === match.line ? '>' : ' ';
                return `${marker} ${num}\t${l}`;
              });
              match.content = contextSlice.join('\n');
            }
          } catch {
            // Fall back to plain match content
          }
        }

        allMatches.push(...fileMatches);
      }

      return {
        success: true,
        pattern,
        filesSearched: files.length,
        totalMatches: allMatches.length,
        truncated: allMatches.length >= maxResults,
        matches: allMatches,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Grep search failed: ${message}` };
    }
  },
});

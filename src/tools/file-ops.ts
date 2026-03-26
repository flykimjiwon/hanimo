import { tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export const readFileTool = tool({
  description: 'Read a file from the filesystem',
  parameters: z.object({
    path: z.string().describe('Absolute or relative file path'),
    startLine: z.number().optional().describe('Start line (1-based)'),
    endLine: z.number().optional().describe('End line (1-based, inclusive)'),
  }),
  execute: async ({ path, startLine, endLine }) => {
    try {
      const raw = await readFile(path, 'utf-8');
      const allLines = raw.split('\n');

      const start = startLine ? Math.max(1, startLine) : 1;
      const end = endLine ? Math.min(allLines.length, endLine) : allLines.length;
      const sliced = allLines.slice(start - 1, end);

      const numbered = sliced.map((line, i) => `${start + i}\t${line}`).join('\n');

      return {
        success: true,
        path,
        totalLines: allLines.length,
        shownRange: { start, end },
        content: numbered,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to read ${path}: ${message}` };
    }
  },
});

export const writeFileTool = tool({
  description: 'Write content to a file (creates directories if needed)',
  parameters: z.object({
    path: z.string().describe('Absolute or relative file path'),
    content: z.string().describe('File content to write'),
  }),
  execute: async ({ path, content }) => {
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
      const lineCount = content.split('\n').length;
      return {
        success: true,
        path,
        bytesWritten: Buffer.byteLength(content, 'utf-8'),
        lineCount,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to write ${path}: ${message}` };
    }
  },
});

export const editFileTool = tool({
  description: 'Edit a file by replacing an exact string match',
  parameters: z.object({
    path: z.string().describe('Absolute or relative file path'),
    oldStr: z.string().describe('Exact string to find (must appear exactly once)'),
    newStr: z.string().describe('Replacement string'),
  }),
  execute: async ({ path, oldStr, newStr }) => {
    try {
      const content = await readFile(path, 'utf-8');

      // Count occurrences
      let count = 0;
      let searchFrom = 0;
      while (true) {
        const idx = content.indexOf(oldStr, searchFrom);
        if (idx === -1) break;
        count++;
        searchFrom = idx + oldStr.length;
      }

      if (count === 0) {
        return {
          success: false,
          error: 'oldStr not found in file. Make sure it matches exactly (including whitespace).',
        };
      }

      if (count > 1) {
        return {
          success: false,
          error: `oldStr found ${count} times. It must appear exactly once. Provide more context to make the match unique.`,
        };
      }

      const updated = content.replace(oldStr, newStr);
      await writeFile(path, updated, 'utf-8');

      return {
        success: true,
        path,
        replacedChars: oldStr.length,
        newChars: newStr.length,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to edit ${path}: ${message}` };
    }
  },
});

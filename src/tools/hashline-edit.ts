import { tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import { checkPathSandbox } from '../core/permission.js';
import { createHash } from 'node:crypto';

/**
 * Short content hash for a line (first 4 chars of md5).
 * Deterministic and collision-resistant enough for line-level anchoring.
 */
function lineHash(line: string): string {
  return createHash('md5').update(line).digest('hex').slice(0, 4);
}

/**
 * Tag each line with its hash: "lineNum#HASH| content"
 */
export function tagLines(content: string, startLine = 1): string {
  const lines = content.split(/\r?\n/);
  return lines
    .map((line, i) => {
      const num = startLine + i;
      const hash = lineHash(line);
      return `${num}#${hash}| ${line}`;
    })
    .join('\n');
}

/**
 * Parse a hash-tagged line reference: "lineNum#HASH"
 */
function parseAnchor(anchor: string): { line: number; hash: string } | null {
  const match = anchor.match(/^(\d+)#([a-f0-9]{4})$/);
  if (!match) return null;
  return { line: parseInt(match[1]!, 10), hash: match[2]! };
}

/**
 * Enhanced read_file that returns hash-tagged lines for edit anchoring.
 */
export const hashReadFileTool = tool({
  description:
    'Read a file with hash-tagged lines for safe editing. Each line is shown as "lineNum#HASH| content". ' +
    'ALWAYS use this instead of read_file when you plan to edit — the HASH anchors prevent stale-line errors. ' +
    'Then use hashline_edit with the anchors to make verified edits.',
  parameters: z.object({
    path: z.string().describe('Absolute or relative file path'),
    startLine: z.number().optional().describe('Start line (1-based)'),
    endLine: z.number().optional().describe('End line (1-based, inclusive)'),
  }),
  execute: async ({ path, startLine, endLine }) => {
    try {
      const blocked = checkPathSandbox(path, process.cwd());
      if (blocked) return { success: false, error: blocked };

      const raw = await readFile(path, 'utf-8');
      const allLines = raw.split(/\r?\n/);

      const start = startLine ? Math.max(1, startLine) : 1;
      const end = endLine ? Math.min(allLines.length, endLine) : allLines.length;
      const sliced = allLines.slice(start - 1, end);

      const tagged = sliced
        .map((line, i) => {
          const num = start + i;
          const hash = lineHash(line);
          return `${num}#${hash}| ${line}`;
        })
        .join('\n');

      return {
        success: true,
        path,
        totalLines: allLines.length,
        shownRange: { start, end },
        content: tagged,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to read ${path}: ${message}` };
    }
  },
});

/**
 * Hash-anchored edit tool. Verifies line content hasn't changed since read.
 */
export const hashlineEditTool = tool({
  description:
    'Edit a file using hash-anchored line references from hashline_read. ' +
    'Provide startAnchor (e.g. "10#a3f1") and endAnchor to define the range, ' +
    'then newContent to replace that range. The hash is verified before editing ' +
    'to prevent stale-line errors.',
  parameters: z.object({
    path: z.string().describe('File path'),
    startAnchor: z.string().describe('Start anchor "lineNum#HASH" from hashline_read'),
    endAnchor: z.string().describe('End anchor "lineNum#HASH" (inclusive)'),
    newContent: z.string().describe('Replacement content for the anchored range'),
  }),
  execute: async ({ path, startAnchor, endAnchor, newContent }) => {
    try {
      const blocked = checkPathSandbox(path, process.cwd());
      if (blocked) return { success: false, error: blocked };

      const start = parseAnchor(startAnchor);
      const end = parseAnchor(endAnchor);
      if (!start) return { success: false, error: `Invalid start anchor: "${startAnchor}". Expected format: "lineNum#HASH"` };
      if (!end) return { success: false, error: `Invalid end anchor: "${endAnchor}". Expected format: "lineNum#HASH"` };
      if (end.line < start.line) return { success: false, error: 'End anchor must be >= start anchor' };

      const raw = await readFile(path, 'utf-8');
      const lines = raw.split(/\r?\n/);

      // Verify start line hash
      const startIdx = start.line - 1;
      if (startIdx < 0 || startIdx >= lines.length) {
        return { success: false, error: `Start line ${start.line} out of range (file has ${lines.length} lines)` };
      }
      const actualStartHash = lineHash(lines[startIdx]!);
      if (actualStartHash !== start.hash) {
        return {
          success: false,
          error: `Start line ${start.line} has changed since you read it (expected hash ${start.hash}, got ${actualStartHash}). Re-read the file with hashline_read.`,
        };
      }

      // Verify end line hash
      const endIdx = end.line - 1;
      if (endIdx < 0 || endIdx >= lines.length) {
        return { success: false, error: `End line ${end.line} out of range (file has ${lines.length} lines)` };
      }
      const actualEndHash = lineHash(lines[endIdx]!);
      if (actualEndHash !== end.hash) {
        return {
          success: false,
          error: `End line ${end.line} has changed since you read it (expected hash ${end.hash}, got ${actualEndHash}). Re-read the file with hashline_read.`,
        };
      }

      // Replace range
      const newLines = newContent.split(/\r?\n/);
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx + 1);
      const eol = raw.includes('\r\n') ? '\r\n' : '\n';
      const updated = [...before, ...newLines, ...after].join(eol);

      await writeFile(path, updated, 'utf-8');

      return {
        success: true,
        path,
        replacedLines: { from: start.line, to: end.line, count: end.line - start.line + 1 },
        newLineCount: newLines.length,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to edit ${path}: ${message}` };
    }
  },
});

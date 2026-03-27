import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileTool, writeFileTool, editFileTool } from '../src/tools/file-ops.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const toolCtx = { toolCallId: 'test', messages: [], abortSignal: undefined as unknown as AbortSignal };
const TEST_DIR = join(process.cwd(), '.test-fileops-tmp');

describe('file-ops', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'test.txt'), 'line one\nline two\nline three\n');
    writeFileSync(join(TEST_DIR, 'dup.txt'), 'hello\nhello\nhello\n');
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('read_file', () => {
    it('should read a file with line numbers', async () => {
      const result = await readFileTool.execute(
        { path: join(TEST_DIR, 'test.txt') },
        toolCtx,
      ) as { success: boolean; content: string; totalLines: number };

      expect(result.success).toBe(true);
      expect(result.totalLines).toBe(4); // trailing newline = empty last line
      expect(result.content).toContain('1\tline one');
    });

    it('should read a specific line range', async () => {
      const result = await readFileTool.execute(
        { path: join(TEST_DIR, 'test.txt'), startLine: 2, endLine: 2 },
        toolCtx,
      ) as { success: boolean; content: string; shownRange: { start: number; end: number } };

      expect(result.success).toBe(true);
      expect(result.shownRange.start).toBe(2);
      expect(result.shownRange.end).toBe(2);
      expect(result.content).toContain('line two');
    });

    it('should fail on nonexistent file', async () => {
      const result = await readFileTool.execute(
        { path: join(TEST_DIR, 'nope.txt') },
        toolCtx,
      ) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read');
    });
  });

  describe('edit_file', () => {
    it('should fail when oldStr not found', async () => {
      const result = await editFileTool.execute(
        { path: join(TEST_DIR, 'test.txt'), oldStr: 'nonexistent string', newStr: 'replacement' },
        toolCtx,
      ) as { success: boolean; error: string; hint?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.hint).toBeDefined();
    });

    it('should fail when oldStr found multiple times', async () => {
      const result = await editFileTool.execute(
        { path: join(TEST_DIR, 'dup.txt'), oldStr: 'hello', newStr: 'world' },
        toolCtx,
      ) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain('3 times');
      expect(result.error).toContain('hashline_edit');
    });

    it('should successfully edit unique string', async () => {
      const result = await editFileTool.execute(
        { path: join(TEST_DIR, 'test.txt'), oldStr: 'line two', newStr: 'LINE TWO REPLACED' },
        toolCtx,
      ) as { success: boolean; path: string };

      expect(result.success).toBe(true);
    });
  });

  describe('write_file', () => {
    it('should create a new file', async () => {
      const newPath = join(TEST_DIR, 'new-file.txt');
      const result = await writeFileTool.execute(
        { path: newPath, content: 'brand new content' },
        toolCtx,
      ) as { success: boolean; bytesWritten: number };

      expect(result.success).toBe(true);
      expect(result.bytesWritten).toBeGreaterThan(0);
    });

    it('should create nested directories', async () => {
      const nestedPath = join(TEST_DIR, 'deep', 'nested', 'file.txt');
      const result = await writeFileTool.execute(
        { path: nestedPath, content: 'nested!' },
        toolCtx,
      ) as { success: boolean };

      expect(result.success).toBe(true);
    });
  });
});

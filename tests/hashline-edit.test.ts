import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tagLines, hashReadFileTool, hashlineEditTool } from '../src/tools/hashline-edit.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const toolCtx = { toolCallId: 'test', messages: [], abortSignal: undefined as unknown as AbortSignal };

// Use a subdirectory of project CWD so sandbox check passes
const TEST_DIR = join(process.cwd(), '.test-hashline-tmp');

describe('hashline-edit', () => {
  describe('tagLines', () => {
    it('should tag each line with lineNum#hash format', () => {
      const content = 'hello\nworld\nfoo';
      const result = tagLines(content);
      const lines = result.split('\n');

      expect(lines).toHaveLength(3);
      for (const line of lines) {
        expect(line).toMatch(/^\d+#[a-f0-9]{4}\| .*/);
      }
    });

    it('should start from custom line number', () => {
      const content = 'line10\nline11';
      const result = tagLines(content, 10);
      expect(result).toMatch(/^10#[a-f0-9]{4}\| line10/);
      expect(result).toMatch(/11#[a-f0-9]{4}\| line11/);
    });

    it('should produce deterministic hashes for same content', () => {
      const a = tagLines('same line');
      const b = tagLines('same line');
      expect(a).toBe(b);
    });

    it('should produce different hashes for different content', () => {
      const a = tagLines('line a');
      const b = tagLines('line b');
      const hashA = a.match(/#([a-f0-9]{4})/)?.[1];
      const hashB = b.match(/#([a-f0-9]{4})/)?.[1];
      expect(hashA).not.toBe(hashB);
    });
  });

  describe('hashlineEditTool (execute)', () => {
    let testFile: string;

    beforeAll(() => {
      mkdirSync(TEST_DIR, { recursive: true });
      testFile = join(TEST_DIR, 'test.txt');
      writeFileSync(testFile, 'line one\nline two\nline three\nline four\n');
    });

    afterAll(() => {
      rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it('should successfully edit with valid anchors', async () => {
      // Read to get hashes
      const readResult = await hashReadFileTool.execute({ path: testFile }, toolCtx) as {
        success: boolean; content: string;
      };
      expect(readResult.success).toBe(true);

      // Parse line 2 and 3 anchors
      const lines = readResult.content.split('\n');
      const anchor2 = lines[1]!.match(/^(\d+#[a-f0-9]{4})\|/)?.[1];
      const anchor3 = lines[2]!.match(/^(\d+#[a-f0-9]{4})\|/)?.[1];
      expect(anchor2).toBeDefined();
      expect(anchor3).toBeDefined();

      // Edit lines 2-3
      const editResult = await hashlineEditTool.execute(
        { path: testFile, startAnchor: anchor2!, endAnchor: anchor3!, newContent: 'replaced two\nreplaced three' },
        toolCtx,
      ) as { success: boolean; replacedLines: { count: number } };

      expect(editResult.success).toBe(true);
      expect(editResult.replacedLines.count).toBe(2);

      // Verify file content
      const content = await readFile(testFile, 'utf-8');
      expect(content).toBe('line one\nreplaced two\nreplaced three\nline four\n');
    });

    it('should reject stale hash (content changed)', async () => {
      // Read file
      const readResult = await hashReadFileTool.execute({ path: testFile }, toolCtx) as {
        success: boolean; content: string;
      };
      expect(readResult.success).toBe(true);
      const lines = readResult.content.split('\n');
      const anchor1 = lines[0]!.match(/^(\d+#[a-f0-9]{4})\|/)?.[1];
      expect(anchor1).toBeDefined();

      // Modify the file behind the agent's back
      writeFileSync(testFile, 'CHANGED\nreplaced two\nreplaced three\nline four\n');

      // Try to edit with old hash — should fail
      const editResult = await hashlineEditTool.execute(
        { path: testFile, startAnchor: anchor1!, endAnchor: anchor1!, newContent: 'new line one' },
        toolCtx,
      ) as { success: boolean; error?: string };

      expect(editResult.success).toBe(false);
      expect(editResult.error).toContain('has changed since you read it');
    });

    it('should reject out-of-range anchor', async () => {
      const editResult = await hashlineEditTool.execute(
        { path: testFile, startAnchor: '999#abcd', endAnchor: '999#abcd', newContent: 'nope' },
        toolCtx,
      ) as { success: boolean; error?: string };

      expect(editResult.success).toBe(false);
      expect(editResult.error).toContain('out of range');
    });

    it('should reject invalid anchor format', async () => {
      const editResult = await hashlineEditTool.execute(
        { path: testFile, startAnchor: 'bad', endAnchor: '1#abcd', newContent: 'nope' },
        toolCtx,
      ) as { success: boolean; error?: string };

      expect(editResult.success).toBe(false);
      expect(editResult.error).toContain('Invalid start anchor');
    });
  });
});

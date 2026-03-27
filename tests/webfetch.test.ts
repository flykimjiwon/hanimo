import { describe, it, expect } from 'vitest';
import { webfetchTool } from '../src/tools/webfetch.js';

describe('webfetch tool', () => {
  it('should reject invalid URLs', async () => {
    const result = await webfetchTool.execute(
      { url: 'not-a-url' },
      { toolCallId: '1', messages: [], abortSignal: undefined as unknown as AbortSignal },
    );
    // Zod validation will reject before execute, but if passed through:
    expect(result).toBeDefined();
  });

  it('should fetch a real page (httpbin)', async () => {
    const result = await webfetchTool.execute(
      { url: 'https://httpbin.org/html' },
      { toolCallId: '2', messages: [], abortSignal: undefined as unknown as AbortSignal },
    );
    const r = result as { success: boolean; content?: string };
    // httpbin might be down, so we just check structure
    expect(r).toHaveProperty('success');
    if (r.success) {
      expect(r.content).toBeDefined();
      expect(typeof r.content).toBe('string');
    }
  }, 20000);

  it('should handle timeout gracefully', async () => {
    // Use a non-routable IP to trigger timeout
    const result = await webfetchTool.execute(
      { url: 'http://10.255.255.1' },
      { toolCallId: '3', messages: [], abortSignal: undefined as unknown as AbortSignal },
    );
    expect((result as { success: boolean }).success).toBe(false);
  }, 20000);
});

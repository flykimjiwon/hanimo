import { describe, it, expect } from 'vitest';
import { compactMessages } from '../src/core/compaction.js';
import type { Message } from '../src/core/types.js';

// Mock model that returns a summary
const mockModel = {
  doGenerate: async () => ({
    text: 'Summary: user asked to fix auth bug. Assistant modified auth.ts.',
    finishReason: 'stop' as const,
    usage: { promptTokens: 100, completionTokens: 50 },
  }),
  specificationVersion: 'v1' as const,
  provider: 'test',
  modelId: 'test-model',
  defaultObjectGenerationMode: undefined,
} as unknown as Parameters<typeof compactMessages>[0];

describe('compaction', () => {
  it('should return messages as-is when under threshold', async () => {
    const messages: Message[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ];
    const result = await compactMessages(mockModel, messages, 6);
    expect(result).toEqual(messages);
  });

  it('should keep recent messages and add summary when over threshold', async () => {
    // Create 12 messages (> keepRecent=4 + 2)
    const messages: Message[] = [];
    for (let i = 0; i < 12; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `message ${i}`,
      });
    }

    // compactMessages will try to call generateText which needs a real model
    // On failure, it falls back to truncation
    const result = await compactMessages(mockModel, messages, 4);

    // Either smart summary or fallback truncation should reduce message count
    expect(result.length).toBeLessThan(messages.length);
    // Recent 4 messages should be preserved
    const lastOriginal = messages[messages.length - 1];
    const lastResult = result[result.length - 1];
    expect(lastResult).toEqual(lastOriginal);
  });

  it('should fallback to truncation on model error', async () => {
    const badModel = {
      ...mockModel,
      doGenerate: async () => { throw new Error('API error'); },
    } as unknown as Parameters<typeof compactMessages>[0];

    const messages: Message[] = [];
    for (let i = 0; i < 12; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg ${i}`,
      });
    }

    const result = await compactMessages(badModel, messages, 4);
    // Fallback: head(2) + summary marker + tail(4) = 7
    expect(result.length).toBeLessThanOrEqual(7);
    // Should have a system message about truncation
    const systemMsgs = result.filter(m => m.role === 'system');
    expect(systemMsgs.length).toBeGreaterThan(0);
  });
});

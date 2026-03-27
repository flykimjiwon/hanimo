import { describe, it, expect } from 'vitest';
import { getModelCapability } from '../src/providers/model-capabilities.js';

describe('getModelCapability', () => {
  it('returns agent for known strong models', () => {
    const cap = getModelCapability('qwen3:8b');
    expect(cap.role).toBe('agent');
    expect(cap.toolCalling).toBe(true);
    expect(cap.codingTier).toBe('strong');
  });

  it('returns agent for qwen3-coder:30b', () => {
    const cap = getModelCapability('qwen3-coder:30b');
    expect(cap.role).toBe('agent');
    expect(cap.toolCalling).toBe(true);
  });

  it('returns chat for models without tool calling', () => {
    const cap = getModelCapability('gemma3:1b');
    expect(cap.role).toBe('chat');
    expect(cap.toolCalling).toBe(false);
  });

  it('returns assistant for moderate-capability models', () => {
    const cap = getModelCapability('qwen3.5:4b');
    expect(cap.role).toBe('assistant');
    expect(cap.toolCalling).toBe(true);
  });

  it('uses prefix matching for unregistered variants', () => {
    // qwen3:some-variant should match qwen3 prefix
    const cap = getModelCapability('qwen3:99b');
    expect(cap.toolCalling).toBe(true);
  });

  it('returns agent for cloud providers regardless of model name', () => {
    const cap = getModelCapability('unknown-model-xyz', 'openai');
    expect(cap.role).toBe('agent');
    expect(cap.toolCalling).toBe(true);

    const cap2 = getModelCapability('anything', 'anthropic');
    expect(cap2.role).toBe('agent');
  });

  it('returns safe default for completely unknown models', () => {
    const cap = getModelCapability('completely-unknown-model-12345');
    expect(cap.role).toBe('chat');
    expect(cap.toolCalling).toBe(false);
  });

  it('handles codegemma as chat (no tool calling)', () => {
    const cap = getModelCapability('codegemma:7b');
    expect(cap.role).toBe('chat');
    expect(cap.toolCalling).toBe(false);
  });
});

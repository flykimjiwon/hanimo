import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SessionStore } from '../src/session/store.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('SessionStore.searchSessions', () => {
  let store: SessionStore;
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'hanimo-test-'));
    store = new SessionStore(dir);

    // Create test sessions
    const s1 = store.createSession('openai', 'gpt-4o');
    store.saveMessage(s1, 'user', 'How do I fix the authentication bug?');
    store.saveMessage(s1, 'assistant', 'Check the auth middleware...');

    const s2 = store.createSession('ollama', 'qwen3:8b');
    store.saveMessage(s2, 'user', 'Refactor the database layer');
    store.saveMessage(s2, 'assistant', 'I will restructure the queries...');
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('should find sessions matching keyword', () => {
    const results = store.searchSessions('authentication');
    expect(results.length).toBe(1);
    expect(results[0]!.matchCount).toBe(1);
    expect(results[0]!.preview).toContain('authentication');
  });

  it('should be case-insensitive', () => {
    const results = store.searchSessions('DATABASE');
    expect(results.length).toBe(1);
  });

  it('should return empty for non-matching keyword', () => {
    const results = store.searchSessions('zzz_nonexistent_zzz');
    expect(results.length).toBe(0);
  });

  it('should respect limit', () => {
    const results = store.searchSessions('the', 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

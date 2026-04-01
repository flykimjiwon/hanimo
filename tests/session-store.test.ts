import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionStore } from '../src/session/store.js';

describe('SessionStore', () => {
  let tmpDir: string;
  let store: SessionStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'hanimo-test-'));
    store = new SessionStore(tmpDir);
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a session and retrieves it', () => {
    const id = store.createSession('ollama', 'qwen3:8b');
    expect(id).toBeTruthy();
    expect(id.length).toBe(36); // UUID

    const session = store.getSession(id);
    expect(session).toBeDefined();
    expect(session!.provider).toBe('ollama');
    expect(session!.model).toBe('qwen3:8b');
    expect(session!.messageCount).toBe(0);
  });

  it('saves and retrieves messages', () => {
    const id = store.createSession('openai', 'gpt-4o');
    store.saveMessage(id, 'user', 'Hello');
    store.saveMessage(id, 'assistant', 'Hi there!');

    const messages = store.getMessages(id);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.role).toBe('user');
    expect(messages[0]!.content).toBe('Hello');
    expect(messages[1]!.role).toBe('assistant');
    expect(messages[1]!.content).toBe('Hi there!');

    const session = store.getSession(id);
    expect(session!.messageCount).toBe(2);
  });

  it('lists sessions sorted by updatedAt descending', async () => {
    const id1 = store.createSession('ollama', 'model-a');
    store.saveMessage(id1, 'user', 'first');

    // Ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 50));

    const id2 = store.createSession('openai', 'model-b');
    store.saveMessage(id2, 'user', 'second');

    const sessions = store.listSessions();
    expect(sessions).toHaveLength(2);
    // Most recently updated first
    expect(sessions[0]!.id).toBe(id2);
    expect(sessions[1]!.id).toBe(id1);
  });

  it('lists sessions with limit', () => {
    store.createSession('a', 'x');
    store.createSession('b', 'y');
    store.createSession('c', 'z');

    const sessions = store.listSessions(2);
    expect(sessions).toHaveLength(2);
  });

  it('deletes a session', () => {
    const id = store.createSession('test', 'model');
    expect(store.getSession(id)).toBeDefined();

    store.deleteSession(id);
    expect(store.getSession(id)).toBeUndefined();
    expect(store.getMessages(id)).toEqual([]);
  });

  it('returns undefined for non-existent session', () => {
    expect(store.getSession('non-existent-id')).toBeUndefined();
    expect(store.getMessages('non-existent-id')).toEqual([]);
  });

  it('ignores saveMessage for non-existent session', () => {
    // Should not throw
    store.saveMessage('non-existent', 'user', 'hello');
  });

  it('handles empty session (no messages)', () => {
    const id = store.createSession('test', 'model');
    const session = store.getSession(id);
    expect(session).toBeDefined();
    expect(session!.messageCount).toBe(0);
    const msgs = store.getMessages(id);
    expect(msgs).toEqual([]);
  });

  it('handles corrupted JSON gracefully', () => {
    // Write invalid JSON to a session file
    const { writeFileSync } = require('node:fs');
    const { join } = require('node:path');
    writeFileSync(join(tmpDir, 'corrupted.json'), '{invalid json!!!}');

    // Should return undefined, not throw
    expect(store.getSession('corrupted')).toBeUndefined();
    expect(store.getMessages('corrupted')).toEqual([]);
  });

  it('handles large message content', () => {
    const id = store.createSession('test', 'model');
    const bigContent = 'x'.repeat(100000);
    store.saveMessage(id, 'user', bigContent);
    const msgs = store.getMessages(id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.content.length).toBe(100000);
  });

  it('searchSessions returns empty for empty store', () => {
    // Create a fresh store with empty dir
    const { mkdtempSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const { join } = require('node:path');
    const emptyDir = mkdtempSync(join(tmpdir(), 'hanimo-empty-'));
    const emptyStore = new SessionStore(emptyDir);
    const results = emptyStore.searchSessions('anything');
    expect(results).toEqual([]);
    require('node:fs').rmSync(emptyDir, { recursive: true, force: true });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionStore } from '../src/session/store.js';

describe('SessionStore', () => {
  let tmpDir: string;
  let store: SessionStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'modol-test-'));
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
});

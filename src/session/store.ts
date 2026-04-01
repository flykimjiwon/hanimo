import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Session, SessionMessage } from './types.js';

// JSON file-based session storage (no native dependencies)
// Layout: ~/.hanimo/sessions/<id>.json

interface SessionData {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider: string;
  model: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
}

export class SessionStore {
  private dir: string;
  private writeLocks = new Set<string>();

  constructor(dirPath?: string) {
    this.dir = dirPath ?? join(homedir(), '.hanimo', 'sessions');
    mkdirSync(this.dir, { recursive: true });
  }

  private sessionPath(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  private readSession(id: string): SessionData | undefined {
    const path = this.sessionPath(id);
    if (!existsSync(path)) return undefined;
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as SessionData;
    } catch {
      return undefined;
    }
  }

  private writeSession(data: SessionData): void {
    writeFileSync(this.sessionPath(data.id), JSON.stringify(data, null, 2));
  }

  createSession(provider: string, model: string): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.writeSession({ id, createdAt: now, updatedAt: now, provider, model, messages: [] });
    return id;
  }

  saveMessage(sessionId: string, role: string, content: string): void {
    // Simple mutex: skip if another write is in progress
    if (this.writeLocks.has(sessionId)) return;
    this.writeLocks.add(sessionId);
    try {
      const data = this.readSession(sessionId);
      if (!data) {
        console.warn(`[session] Warning: session ${sessionId.slice(0, 8)} not found, message not saved`);
        return;
      }
      data.messages.push({ id: randomUUID(), role, content, createdAt: new Date().toISOString() });
      data.updatedAt = new Date().toISOString();
      this.writeSession(data);
    } finally {
      this.writeLocks.delete(sessionId);
    }
  }

  getSession(id: string): Session | undefined {
    const data = this.readSession(id);
    if (!data) return undefined;
    return {
      id: data.id,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      provider: data.provider,
      model: data.model,
      messageCount: data.messages.length,
    };
  }

  getMessages(sessionId: string): SessionMessage[] {
    const data = this.readSession(sessionId);
    if (!data) return [];
    return data.messages.map((m) => ({
      id: m.id,
      sessionId,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  listSessions(limit?: number): Session[] {
    const files = readdirSync(this.dir).filter((f) => f.endsWith('.json'));
    const sessions: Session[] = [];

    for (const file of files) {
      const id = file.replace('.json', '');
      const data = this.readSession(id);
      if (data) {
        sessions.push({
          id: data.id,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          provider: data.provider,
          model: data.model,
          messageCount: data.messages.length,
        });
      }
    }

    // Sort by updatedAt descending
    sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return limit ? sessions.slice(0, limit) : sessions;
  }

  deleteSession(id: string): void {
    const path = this.sessionPath(id);
    if (existsSync(path)) unlinkSync(path);
  }

  /**
   * Search sessions by keyword in message content.
   */
  searchSessions(keyword: string, limit = 10): Array<Session & { matchCount: number; preview: string }> {
    const files = readdirSync(this.dir).filter((f) => f.endsWith('.json'));
    const results: Array<Session & { matchCount: number; preview: string }> = [];
    const lower = keyword.toLowerCase();

    for (const file of files) {
      const id = file.replace('.json', '');
      const data = this.readSession(id);
      if (!data) continue;

      let matchCount = 0;
      let preview = '';
      for (const m of data.messages) {
        if (m.content.toLowerCase().includes(lower)) {
          matchCount++;
          if (!preview) {
            // Extract context around match
            const idx = m.content.toLowerCase().indexOf(lower);
            const start = Math.max(0, idx - 40);
            const end = Math.min(m.content.length, idx + keyword.length + 40);
            preview = (start > 0 ? '...' : '') + m.content.slice(start, end) + (end < m.content.length ? '...' : '');
          }
        }
      }

      if (matchCount > 0) {
        results.push({
          id: data.id,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          provider: data.provider,
          model: data.model,
          messageCount: data.messages.length,
          matchCount,
          preview,
        });
      }
    }

    results.sort((a, b) => b.matchCount - a.matchCount);
    return results.slice(0, limit);
  }

  /**
   * Fork a session: copy messages up to a given index into a new session.
   */
  forkSession(sourceId: string, atMessageIndex?: number): string | null {
    const data = this.readSession(sourceId);
    if (!data) return null;

    // Validate index bounds
    if (atMessageIndex !== undefined && (atMessageIndex < 0 || atMessageIndex > data.messages.length)) {
      return null;
    }

    const newId = randomUUID();
    const now = new Date().toISOString();
    const messages = atMessageIndex !== undefined
      ? data.messages.slice(0, atMessageIndex)
      : [...data.messages];

    this.writeSession({
      id: newId,
      createdAt: now,
      updatedAt: now,
      provider: data.provider,
      model: data.model,
      messages,
    });

    return newId;
  }

  close(): void {
    // No-op (JSON files don't need cleanup)
  }
}

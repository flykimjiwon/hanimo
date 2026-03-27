import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Session, SessionMessage } from './types.js';

// JSON file-based session storage (no native dependencies)
// Layout: ~/.dev-anywhere/sessions/<id>.json

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

  constructor(dirPath?: string) {
    this.dir = dirPath ?? join(homedir(), '.dev-anywhere', 'sessions');
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
    const data = this.readSession(sessionId);
    if (!data) return;
    data.messages.push({ id: randomUUID(), role, content, createdAt: new Date().toISOString() });
    data.updatedAt = new Date().toISOString();
    this.writeSession(data);
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

  close(): void {
    // No-op (JSON files don't need cleanup)
  }
}

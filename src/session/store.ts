import Database from 'better-sqlite3';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Session, SessionMessage } from './types.js';

interface SessionRow {
  id: string;
  created_at: string;
  updated_at: string;
  provider: string;
  model: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

interface CountRow {
  count: number;
}

export class SessionStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dir = join(homedir(), '.dev-anywhere');
    mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath ?? join(dir, 'sessions.db'));
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        provider TEXT NOT NULL,
        model TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  createSession(provider: string, model: string): string {
    const id = randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(
      'INSERT INTO sessions (id, created_at, updated_at, provider, model) VALUES (?, ?, ?, ?, ?)',
    );
    stmt.run(id, now, now, provider, model);

    return id;
  }

  saveMessage(sessionId: string, role: string, content: string): void {
    const id = randomUUID();
    const now = new Date().toISOString();

    const insertMsg = this.db.prepare(
      'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    const updateSession = this.db.prepare(
      'UPDATE sessions SET updated_at = ? WHERE id = ?',
    );

    const transaction = this.db.transaction(() => {
      insertMsg.run(id, sessionId, role, content, now);
      updateSession.run(now, sessionId);
    });

    transaction();
  }

  getSession(id: string): Session | undefined {
    const row = this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(id) as SessionRow | undefined;

    if (!row) return undefined;

    const countRow = this.db
      .prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?')
      .get(id) as CountRow;

    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      provider: row.provider,
      model: row.model,
      messageCount: countRow.count,
    };
  }

  getMessages(sessionId: string): SessionMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as MessageRow[];

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  listSessions(limit?: number): Session[] {
    const query = limit
      ? 'SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?'
      : 'SELECT * FROM sessions ORDER BY updated_at DESC';

    const rows = (
      limit
        ? this.db.prepare(query).all(limit)
        : this.db.prepare(query).all()
    ) as SessionRow[];

    return rows.map((row) => {
      const countRow = this.db
        .prepare('SELECT COUNT(*) as count FROM messages WHERE session_id = ?')
        .get(row.id) as CountRow;

      return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        provider: row.provider,
        model: row.model,
        messageCount: countRow.count,
      };
    });
  }

  deleteSession(id: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(id);
      this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    });

    transaction();
  }

  close(): void {
    this.db.close();
  }
}

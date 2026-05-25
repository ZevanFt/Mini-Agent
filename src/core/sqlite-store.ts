import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { logger } from '@/utils/logger';

export interface StoredSession {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  message_count: number;
  tool_calls: number;
  metadata?: Record<string, any>;
}

export interface StoredMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: string;
  created_at: Date;
}

export interface StoredCheckpoint {
  id: string;
  session_id: string;
  label: string;
  file_changes: string;
  created_at: Date;
}

export interface StoredMemory {
  id: string;
  category: string;
  key: string;
  value: string;
  created_at: Date;
  updated_at: Date;
  access_count: number;
}

export class SQLiteStore {
  private db: Database | null = null;
  private dbPath: string;

  constructor(projectDir: string = process.cwd()) {
    this.dbPath = path.join(projectDir, '.miniagent', 'miniagent.db');
  }

  async initialize(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    await this.createTables();
    logger.info('SQLite store initialized', { path: this.dbPath });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        tool_calls INTEGER DEFAULT 0,
        metadata TEXT
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        label TEXT NOT NULL,
        file_changes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 0,
        UNIQUE(category, key)
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'medium',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        metadata TEXT
      )
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        tool_name TEXT NOT NULL,
        duration_ms INTEGER,
        success BOOLEAN NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL
      )
    `);

    logger.debug('SQLite tables created');
  }

  // Session methods
  async createSession(session: Omit<StoredSession, 'id' | 'created_at' | 'updated_at'>): Promise<StoredSession> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const newSession: StoredSession = {
      id,
      ...session,
      created_at: new Date(now),
      updated_at: new Date(now),
    };

    await this.db.run(
      `INSERT INTO sessions (id, name, created_at, updated_at, message_count, tool_calls, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newSession.id,
        newSession.name,
        newSession.created_at.toISOString(),
        newSession.updated_at.toISOString(),
        newSession.message_count,
        newSession.tool_calls,
        newSession.metadata ? JSON.stringify(newSession.metadata) : null,
      ]
    );

    logger.info('Session created', { id: newSession.id });
    return newSession;
  }

  async getSession(id: string): Promise<StoredSession | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.get('SELECT * FROM sessions WHERE id = ?', id);
    return row ? this.parseSession(row) : null;
  }

  async listSessions(limit: number = 50, offset: number = 0): Promise<StoredSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.all(
      'SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ? OFFSET ?',
      limit,
      offset
    );
    return rows.map(this.parseSession);
  }

  async deleteSession(id: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run('DELETE FROM messages WHERE session_id = ?', id);
    await this.db.run('DELETE FROM checkpoints WHERE session_id = ?', id);
    const result = await this.db.run('DELETE FROM sessions WHERE id = ?', id);
    
    return (result.changes ?? 0) > 0;
  }

  // Message methods
  async addMessage(message: Omit<StoredMessage, 'id' | 'created_at'>): Promise<StoredMessage> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const newMessage: StoredMessage = {
      id,
      ...message,
      created_at: new Date(now),
    };

    await this.db.run(
      `INSERT INTO messages (id, session_id, role, content, tool_calls, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newMessage.id,
        newMessage.session_id,
        newMessage.role,
        newMessage.content,
        newMessage.tool_calls || null,
        newMessage.created_at.toISOString(),
      ]
    );

    await this.db.run(
      'UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?',
      [now, message.session_id]
    );

    return newMessage;
  }

  async getMessages(sessionId: string, limit: number = 100): Promise<StoredMessage[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.all(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?',
      sessionId,
      limit
    );
    return rows.map(this.parseMessage);
  }

  // Checkpoint methods
  async createCheckpoint(checkpoint: Omit<StoredCheckpoint, 'id' | 'created_at'>): Promise<StoredCheckpoint> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const newCheckpoint: StoredCheckpoint = {
      id,
      ...checkpoint,
      created_at: new Date(now),
    };

    await this.db.run(
      `INSERT INTO checkpoints (id, session_id, label, file_changes, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        newCheckpoint.id,
        newCheckpoint.session_id,
        newCheckpoint.label,
        newCheckpoint.file_changes,
        newCheckpoint.created_at.toISOString(),
      ]
    );

    return newCheckpoint;
  }

  async getCheckpoints(sessionId: string): Promise<StoredCheckpoint[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.all(
      'SELECT * FROM checkpoints WHERE session_id = ? ORDER BY created_at DESC',
      sessionId
    );
    return rows.map(this.parseCheckpoint);
  }

  // Memory methods
  async storeMemory(category: string, key: string, value: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO memories (id, category, key, value, created_at, updated_at, access_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(category, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
      [`mem_${category}_${key}`, category, key, value, now, now]
    );
  }

  async getMemory(category: string, key: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.get(
      'SELECT value FROM memories WHERE category = ? AND key = ?',
      category,
      key
    );
    
    if (row) {
      await this.db.run(
        'UPDATE memories SET access_count = access_count + 1, updated_at = ? WHERE category = ? AND key = ?',
        [new Date().toISOString(), category, key]
      );
      return row.value;
    }
    
    return null;
  }

  async searchMemories(query: string, limit: number = 10): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return this.db.all(
      'SELECT * FROM memories WHERE key LIKE ? OR value LIKE ? ORDER BY access_count DESC LIMIT ?',
      `%${query}%`,
      `%${query}%`,
      limit
    );
  }

  async forgetMemory(category: string, key: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.run(
      'DELETE FROM memories WHERE category = ? AND key = ?',
      category,
      key
    );
    return (result.changes ?? 0) > 0;
  }

  // Usage stats methods
  async recordUsage(
    sessionId: string | null,
    toolName: string,
    durationMs: number,
    success: boolean,
    error?: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.run(
      `INSERT INTO usage_stats (session_id, tool_name, duration_ms, success, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, toolName, durationMs, success, error || null, new Date().toISOString()]
    );
  }

  async getUsageStats(days: number = 7): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return this.db.all(
      `SELECT 
        tool_name,
        COUNT(*) as total_calls,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
        AVG(duration_ms) as avg_duration,
        MIN(duration_ms) as min_duration,
        MAX(duration_ms) as max_duration
       FROM usage_stats
       WHERE created_at >= datetime('now', '-${days} days')
       GROUP BY tool_name
       ORDER BY total_calls DESC`
    );
  }

  // Utility methods
  private parseSession(row: any): StoredSession {
    return {
      id: row.id,
      name: row.name,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      message_count: row.message_count,
      tool_calls: row.tool_calls,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private parseMessage(row: any): StoredMessage {
    return {
      id: row.id,
      session_id: row.session_id,
      role: row.role,
      content: row.content,
      tool_calls: row.tool_calls,
      created_at: new Date(row.created_at),
    };
  }

  private parseCheckpoint(row: any): StoredCheckpoint {
    return {
      id: row.id,
      session_id: row.session_id,
      label: row.label,
      file_changes: row.file_changes,
      created_at: new Date(row.created_at),
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('SQLite store closed');
    }
  }
}

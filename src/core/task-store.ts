import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { logger } from '@/utils/logger';

export interface StoredTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  metadata?: Record<string, any>;
}

export class TaskStore {
  private db: Database | null = null;
  private dbPath: string;

  constructor(projectDir: string = process.cwd()) {
    this.dbPath = path.join(projectDir, '.miniagent', 'tasks.db');
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
    logger.info('Task store initialized', { path: this.dbPath });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

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
      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    logger.debug('Task tables created');
  }

  async createTask(task: Omit<StoredTask, 'id' | 'created_at' | 'updated_at'>): Promise<StoredTask> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const newTask: StoredTask = {
      id,
      ...task,
      created_at: new Date(now),
      updated_at: new Date(now),
    };

    await this.db.run(
      `INSERT INTO tasks (id, title, description, status, priority, created_at, updated_at, completed_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTask.id,
        newTask.title,
        newTask.description,
        newTask.status,
        newTask.priority,
        newTask.created_at.toISOString(),
        newTask.updated_at.toISOString(),
        newTask.completed_at?.toISOString() || null,
        newTask.metadata ? JSON.stringify(newTask.metadata) : null,
      ]
    );

    await this.addHistory(newTask.id, 'created', `Task created: ${newTask.title}`);

    logger.info('Task created', { id: newTask.id, title: newTask.title });
    return newTask;
  }

  async getTask(id: string): Promise<StoredTask | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.get('SELECT * FROM tasks WHERE id = ?', id);
    if (!row) return null;

    return this.parseTask(row);
  }

  async listTasks(
    status?: StoredTask['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<StoredTask[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM tasks';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = await this.db.all(query, params);
    return rows.map(this.parseTask);
  }

  async updateTask(id: string, updates: Partial<Pick<StoredTask, 'status' | 'priority' | 'description' | 'metadata'>>): Promise<StoredTask | null> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getTask(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const completedAt = updates.status === 'completed' ? now : existing.completed_at?.toISOString();

    const setClause = Object.keys(updates)
      .filter(k => k !== 'id' && k !== 'created_at')
      .map(k => `${k} = ?`)
      .join(', ');

    const values = [
      ...Object.keys(updates).map(k => {
        const val = updates[k as keyof typeof updates];
        return typeof val === 'object' ? JSON.stringify(val) : val;
      }),
      now,
      completedAt,
      id,
    ];

    await this.db.run(
      `UPDATE tasks SET ${setClause}, updated_at = ?, completed_at = ? WHERE id = ?`,
      values
    );

    await this.addHistory(id, 'updated', `Task updated: ${JSON.stringify(updates)}`);

    logger.info('Task updated', { id, updates });
    return this.getTask(id);
  }

  async deleteTask(id: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.run('DELETE FROM tasks WHERE id = ?', id);
    const deleted = (result.changes ?? 0) > 0;

    if (deleted) {
      await this.addHistory(id, 'deleted', 'Task deleted');
      logger.info('Task deleted', { id });
    }

    return deleted;
  }

  async getHistory(taskId: string, limit: number = 20): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    return this.db.all(
      'SELECT * FROM task_history WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?',
      taskId,
      limit
    );
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const stats = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM tasks
    `);

    return {
      total: stats.total || 0,
      pending: stats.pending || 0,
      in_progress: stats.in_progress || 0,
      completed: stats.completed || 0,
      failed: stats.failed || 0,
      cancelled: stats.cancelled || 0,
    };
  }

  private parseTask(row: any): StoredTask {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private async addHistory(taskId: string, action: string, details?: string): Promise<void> {
    if (!this.db) return;

    await this.db.run(
      'INSERT INTO task_history (task_id, action, details, timestamp) VALUES (?, ?, ?, ?)',
      taskId,
      action,
      details || '',
      new Date().toISOString()
    );
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('Task store closed');
    }
  }
}

/**
 * SQLite 持久化存储 - TaskStore
 * 
 * 职责：
 * - 任务数据的持久化存储
 * - 从 SQLite 加载任务到内存
 * - 自动创建表和索引
 */

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs';
import type { Task, TaskStatus, TaskPriority, TaskResult, CreateTaskParams, UpdateTaskParams, ListTasksFilter } from './types.js';
import { logger } from '../utils/logger.js';

export class TaskStore {
  private db: Database | null = null;
  private dbPath: string;
  private initialized = false;

  constructor(dataDir: string) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = `${dataDir}/tasks.db`;
    logger.info('[TaskStore] configured at %s', this.dbPath);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    await this.db.run('PRAGMA journal_mode = WAL');
    await this.db.run('PRAGMA foreign_keys = ON');

    this.initialized = true;
    logger.info('[TaskStore] initialized at %s', this.dbPath);
  }

  private assertDb(): Database {
    if (!this.db) throw new Error('[TaskStore] Database not initialized. Call initialize() first.');
    return this.db;
  }

  async initSchema(): Promise<void> {
    if (this.initialized) return;
    await this.initialize();

    const db = this.assertDb();
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'medium',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT NOT NULL DEFAULT 'agent',
        parent_id TEXT,
        children TEXT DEFAULT '[]',
        assigned_agent TEXT,
        result_summary TEXT,
        result_output TEXT,
        result_files_modified TEXT,
        result_tokens_used INTEGER,
        result_duration INTEGER,
        tags TEXT DEFAULT '[]',
        due_date TEXT,
        FOREIGN KEY (parent_id) REFERENCES tasks(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    `);

    logger.info('[TaskStore] schema initialized');
  }

  async insert(task: Task): Promise<void> {
    await this.initSchema();

    const db = this.assertDb();
    const result = task.result;
    await db.run(`
      INSERT OR REPLACE INTO tasks (
        id, title, description, status, priority,
        created_at, updated_at, created_by,
        parent_id, children, assigned_agent,
        result_summary, result_output, result_files_modified, result_tokens_used, result_duration,
        tags, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      task.id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.createdAt,
      task.updatedAt,
      task.createdBy,
      task.parentId || null,
      JSON.stringify(task.children),
      task.assignedAgent || null,
      result?.summary || null,
      result?.output || null,
      result?.filesModified ? JSON.stringify(result.filesModified) : null,
      result?.tokensUsed || null,
      result?.duration || null,
      JSON.stringify(task.tags || []),
      task.dueDate || null,
    ]);

    logger.debug('[TaskStore] inserted task %s: %s', task.id, task.title);
  }

  async loadAll(): Promise<Task[]> {
    await this.initSchema();

    const db = this.assertDb();
    const rows = await db.all('SELECT * FROM tasks') as Array<Record<string, unknown>>;
    return rows.map(row => this.rowToTask(row));
  }

  async update(task: Task): Promise<void> {
    await this.initSchema();

    const db = this.assertDb();
    const result = task.result;
    await db.run(`
      UPDATE tasks SET
        title = ?,
        description = ?,
        status = ?,
        priority = ?,
        updated_at = ?,
        parent_id = ?,
        children = ?,
        assigned_agent = ?,
        result_summary = ?,
        result_output = ?,
        result_files_modified = ?,
        result_tokens_used = ?,
        result_duration = ?,
        tags = ?,
        due_date = ?
      WHERE id = ?
    `, [
      task.title,
      task.description,
      task.status,
      task.priority,
      task.updatedAt,
      task.parentId || null,
      JSON.stringify(task.children),
      task.assignedAgent || null,
      result?.summary || null,
      result?.output || null,
      result?.filesModified ? JSON.stringify(result.filesModified) : null,
      result?.tokensUsed || null,
      result?.duration || null,
      JSON.stringify(task.tags || []),
      task.dueDate || null,
      task.id,
    ]);

    logger.debug('[TaskStore] updated task %s', task.id);
  }

  async delete(id: string): Promise<void> {
    await this.initSchema();

    const db = this.assertDb();
    await db.run('DELETE FROM tasks WHERE id = ?', id);
    logger.debug('[TaskStore] deleted task %s', id);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('[TaskStore] closed');
    }
  }

  private rowToTask(row: Record<string, unknown>): Task {
    let result: TaskResult | undefined;
    if (row.result_summary) {
      result = {
        summary: String(row.result_summary),
        output: row.result_output ? String(row.result_output) : undefined,
        filesModified: row.result_files_modified ? JSON.parse(String(row.result_files_modified)) : undefined,
        tokensUsed: row.result_tokens_used ? Number(row.result_tokens_used) : undefined,
        duration: row.result_duration ? Number(row.result_duration) : undefined,
      };
    }

    return {
      id: String(row.id),
      title: String(row.title),
      description: String(row.description || ''),
      status: String(row.status) as TaskStatus,
      priority: String(row.priority) as TaskPriority,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      createdBy: String(row.created_by) as 'user' | 'agent',
      parentId: row.parent_id ? String(row.parent_id) : undefined,
      children: row.children ? JSON.parse(String(row.children)) : [],
      assignedAgent: row.assigned_agent ? String(row.assigned_agent) : undefined,
      result,
      tags: row.tags ? JSON.parse(String(row.tags)) : [],
      dueDate: row.due_date ? String(row.due_date) : undefined,
    };
  }
}

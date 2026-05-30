import type { Task, CreateTaskParams, UpdateTaskParams, ListTasksFilter, TaskStatus } from './types.js';
import { TaskStore } from './store.js';
import { logger } from '../utils/logger.js';

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private store?: TaskStore;
  private initialized = false;

  constructor(dataDir?: string) {
    if (dataDir) {
      this.store = new TaskStore(dataDir);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!this.store) {
      this.initialized = true;
      return;
    }
    try {
      await this.store.initSchema();
      const persisted = await this.store.loadAll();
      for (const task of persisted) {
        this.tasks.set(task.id, task);
      }
      logger.info('[TaskManager] loaded %d tasks from store', persisted.length);
    } catch (error) {
      logger.error('[TaskManager] failed to load tasks from store:', error);
    }
    this.initialized = true;
  }

  private async persist(task: Task): Promise<void> {
    try {
      await this.store?.insert(task);
    } catch (error) {
      logger.error('[TaskManager] failed to persist task %s:', task.id, error);
    }
  }

  private async persistUpdate(task: Task): Promise<void> {
    try {
      await this.store?.update(task);
    } catch (error) {
      logger.error('[TaskManager] failed to update task %s in store:', task.id, error);
    }
  }

  async create(params: CreateTaskParams): Promise<Task> {
    const id = generateId();
    const now = new Date().toISOString();

    const task: Task = {
      id,
      title: params.title,
      description: params.description || '',
      status: 'pending',
      priority: params.priority || 'medium',
      createdAt: now,
      updatedAt: now,
      createdBy: 'agent',
      children: [],
      tags: params.tags || [],
      ...(params.parentId ? { parentId: params.parentId } : {}),
    };

    this.tasks.set(id, task);

    if (params.parentId) {
      const parent = this.tasks.get(params.parentId);
      if (parent) {
        parent.children.push(id);
        parent.updatedAt = now;
      }
    }

    await this.persist(task);

    return task;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  async update(id: string, params: UpdateTaskParams): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    if (params.status) task.status = params.status;
    if (params.description) task.description = params.description;
    if (params.priority) task.priority = params.priority;
    if (params.result) task.result = { ...task.result, ...params.result } as Task['result'];

    task.updatedAt = new Date().toISOString();
    await this.persistUpdate(task);
    return task;
  }

  list(filter: ListTasksFilter = {}): Task[] {
    let tasks = Array.from(this.tasks.values());

    if (filter.status && filter.status !== 'all') {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter.priority) {
      tasks = tasks.filter(t => t.priority === filter.priority);
    }

    if (filter.assignedToMe) {
      tasks = tasks.filter(t => t.assignedAgent);
    }

    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const limit = filter.limit || 50;
    return tasks.slice(0, limit);
  }

  addChild(parentId: string, childId: string): boolean {
    const parent = this.tasks.get(parentId);
    if (!parent) return false;

    if (!parent.children.includes(childId)) {
      parent.children.push(childId);
      parent.updatedAt = new Date().toISOString();
    }

    const child = this.tasks.get(childId);
    if (child) {
      child.parentId = parentId;
      child.updatedAt = new Date().toISOString();
    }

    return true;
  }

  async remove(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task) return false;

    if (task.parentId) {
      const parent = this.tasks.get(task.parentId);
      if (parent) {
        parent.children = parent.children.filter(c => c !== id);
        parent.updatedAt = new Date().toISOString();
      }
    }

    for (const childId of task.children) {
      const child = this.tasks.get(childId);
      if (child) {
        child.parentId = undefined;
      }
    }

    this.tasks.delete(id);
    try {
      await this.store?.delete(id);
    } catch (error) {
      logger.error('[TaskManager] failed to delete task %s from store:', id, error);
    }
    return true;
  }

  getByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter((t: Task) => t.status === status);
  }

  getTree(rootId?: string): Task[] {
    if (rootId) {
      const root = this.tasks.get(rootId);
      if (!root) return [];
      return this.getSubtree(root);
    }

    return Array.from(this.tasks.values())
      .filter(t => !t.parentId)
      .flatMap(t => this.getSubtree(t));
  }

  private getSubtree(task: Task): Task[] {
    return [task, ...task.children
      .map(id => this.tasks.get(id))
      .filter((c): c is Task => c !== undefined)
      .flatMap(c => this.getSubtree(c))];
  }

  count(): number {
    return this.tasks.size;
  }

  clear(): void {
    this.tasks.clear();
  }

  summary(): { total: number; byStatus: Record<string, number> } {
    const byStatus: Record<string, number> = {};
    for (const task of this.tasks.values()) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    }

    return {
      total: this.tasks.size,
      byStatus,
    };
  }

  async close(): Promise<void> {
    await this.store?.close();
  }
}

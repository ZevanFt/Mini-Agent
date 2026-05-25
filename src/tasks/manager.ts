import type { Task, CreateTaskParams, UpdateTaskParams, ListTasksFilter, TaskStatus } from './types.js';

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class TaskManager {
  private tasks: Map<string, Task> = new Map();

  create(params: CreateTaskParams): Task {
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

    return task;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  update(id: string, params: UpdateTaskParams): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    if (params.status) task.status = params.status;
    if (params.description) task.description = params.description;
    if (params.priority) task.priority = params.priority;
    if (params.result) task.result = { ...task.result, ...params.result } as Task['result'];

    task.updatedAt = new Date().toISOString();
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

  remove(id: string): boolean {
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
}

import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';

export interface BackgroundTask {
  id: string;
  name: string;
  command: string;
  args: string[];
  pid: number;
  status: 'running' | 'stopped' | 'error';
  logs: string[];
  startTime: Date;
  process: ChildProcess;
}

export interface BackgroundTaskOptions {
  maxTasks?: number;
  maxLogLines?: number;
}

export class BackgroundTaskManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private maxTasks: number;
  private maxLogLines: number;

  constructor(options?: BackgroundTaskOptions) {
    this.maxTasks = options?.maxTasks || 5;
    this.maxLogLines = options?.maxLogLines || 1000;
  }

  start(name: string, command: string, args: string[] = []): BackgroundTask {
    if (this.tasks.size >= this.maxTasks) {
      throw new Error(`Maximum number of tasks (${this.maxTasks}) reached`);
    }

    const id = randomUUID();
    const process = spawn(command, args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const task: BackgroundTask = {
      id,
      name,
      command,
      args,
      pid: process.pid ?? -1,
      status: 'running',
      logs: [],
      startTime: new Date(),
      process,
    };

    process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      task.logs.push(output);
      if (task.logs.length > this.maxLogLines) {
        task.logs = task.logs.slice(-this.maxLogLines);
      }
    });

    process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      task.logs.push(output);
      if (task.logs.length > this.maxLogLines) {
        task.logs = task.logs.slice(-this.maxLogLines);
      }
    });

    process.on('error', () => {
      task.status = 'error';
    });

    process.on('close', () => {
      if (task.status !== 'error') {
        task.status = 'stopped';
      }
    });

    this.tasks.set(id, task);
    return task;
  }

  stop(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task || task.status !== 'running') {
      return false;
    }

    try {
      task.process.kill('SIGTERM');
      task.status = 'stopped';
      return true;
    } catch {
      return false;
    }
  }

  list(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  getLogs(id: string): string[] {
    const task = this.tasks.get(id);
    if (!task) {
      return [];
    }
    return [...task.logs];
  }

  getStatus(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  cleanup(): void {
    for (const task of this.tasks.values()) {
      if (task.status === 'running') {
        try {
          task.process.kill('SIGTERM');
        } catch {
          // ignore
        }
        task.status = 'stopped';
      }
    }
    this.tasks.clear();
  }
}

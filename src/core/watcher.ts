import fs from 'fs';
import path from 'path';

export type WatchEvent = 'add' | 'change' | 'delete';

export interface FileChangeEvent {
  type: WatchEvent;
  filePath: string;
  timestamp: Date;
}

export interface WatcherOptions {
  ignored?: string[];
  ignoreDotFiles?: boolean;
}

export class FileWatcher {
  private watchedDir: string;
  private listeners: ((event: FileChangeEvent) => void)[] = [];
  private ignored: string[];
  private ignoreDotFiles: boolean;
  private watching: boolean = false;
  private fsWatchers: fs.FSWatcher[] = [];
  private knownFiles: Map<string, number> = new Map();

  constructor(watchedDir: string, options?: WatcherOptions) {
    this.watchedDir = watchedDir;
    this.ignored = options?.ignored || ['node_modules', '.git'];
    this.ignoreDotFiles = options?.ignoreDotFiles ?? true;
  }

  start(): void {
    if (this.watching) {
      return;
    }
    this.watching = true;
    this.scanDirectory(this.watchedDir);
    this.watchRecursive(this.watchedDir);
  }

  stop(): void {
    this.watching = false;
    for (const w of this.fsWatchers) {
      w.close();
    }
    this.fsWatchers = [];
    this.knownFiles.clear();
  }

  on(listener: (event: FileChangeEvent) => void): void {
    this.listeners.push(listener);
  }

  off(listener: (event: FileChangeEvent) => void): void {
    const idx = this.listeners.indexOf(listener);
    if (idx !== -1) {
      this.listeners.splice(idx, 1);
    }
  }

  private emit(event: FileChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
      }
    }
  }

  private scanDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (this.shouldIgnore(fullPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        this.scanDirectory(fullPath);
      } else {
        try {
          const stat = fs.statSync(fullPath);
          this.knownFiles.set(fullPath, stat.mtimeMs);
        } catch {
        }
      }
    }
  }

  private watchRecursive(dir: string): void {
    if (!fs.existsSync(dir)) {
      return;
    }
    try {
      const watcher = fs.watch(dir, { recursive: false }, (_eventType, filename) => {
        if (!filename || !this.watching) {
          return;
        }
        const fullPath = path.join(dir, filename);
        if (this.shouldIgnore(fullPath)) {
          return;
        }

        const exists = fs.existsSync(fullPath);
        const isDir = exists && fs.statSync(fullPath).isDirectory();

        if (exists && !isDir) {
          const stat = fs.statSync(fullPath);
          const known = this.knownFiles.get(fullPath);
          if (known === undefined) {
            this.knownFiles.set(fullPath, stat.mtimeMs);
            this.emit({ type: 'add', filePath: fullPath, timestamp: new Date() });
          } else if (stat.mtimeMs > known) {
            this.knownFiles.set(fullPath, stat.mtimeMs);
            this.emit({ type: 'change', filePath: fullPath, timestamp: new Date() });
          }
        } else if (exists && isDir) {
          this.watchRecursive(fullPath);
        } else {
          this.knownFiles.delete(fullPath);
          this.emit({ type: 'delete', filePath: fullPath, timestamp: new Date() });
        }
      });
      this.fsWatchers.push(watcher);
    } catch {
    }

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !this.shouldIgnore(path.join(dir, entry.name))) {
          this.watchRecursive(path.join(dir, entry.name));
        }
      }
    } catch {
    }
  }

  private shouldIgnore(filePath: string): boolean {
    const base = path.basename(filePath);
    if (this.ignoreDotFiles && base.startsWith('.') && !this.watchedDir.endsWith(base)) {
      return true;
    }
    for (const pattern of this.ignored) {
      if (filePath.includes(pattern)) {
        return true;
      }
    }
    return false;
  }
}

import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export interface PromptEntry {
  id: string;
  prompt: string;
  timestamp: Date;
  sessionId?: string;
}

export interface PromptHistoryOptions {
  maxEntries?: number;
  storageDir?: string;
}

export class PromptHistory {
  private entries: PromptEntry[] = [];
  private maxEntries: number;
  private storageDir: string;
  private currentIndex: number = -1;
  private storageFile: string;

  constructor(options?: PromptHistoryOptions) {
    this.maxEntries = options?.maxEntries || 100;
    this.storageDir = options?.storageDir || join(process.env.HOME || '~', '.miniagent', 'history');
    this.storageFile = join(this.storageDir, 'prompts.json');
    this.load();
  }

  add(prompt: string, sessionId?: string): void {
    const entry: PromptEntry = {
      id: randomUUID(),
      prompt,
      timestamp: new Date(),
      sessionId,
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    this.currentIndex = -1;
    this.save();
  }

  getRecent(count: number = 10): PromptEntry[] {
    return this.entries.slice(-count).reverse();
  }

  search(query: string): PromptEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.entries
      .filter(entry => entry.prompt.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getPrevious(currentIndex?: number): PromptEntry | undefined {
    if (this.entries.length === 0) return undefined;

    if (currentIndex === undefined) {
      currentIndex = this.currentIndex;
    }

    if (currentIndex === -1) {
      this.currentIndex = this.entries.length - 1;
    } else if (currentIndex > 0) {
      this.currentIndex = currentIndex - 1;
    }

    return this.entries[this.currentIndex];
  }

  getNext(currentIndex?: number): PromptEntry | undefined {
    if (this.entries.length === 0 || this.currentIndex === -1) return undefined;

    if (currentIndex === undefined) {
      currentIndex = this.currentIndex;
    }

    if (currentIndex < this.entries.length - 1) {
      this.currentIndex = currentIndex + 1;
      return this.entries[this.currentIndex];
    }

    this.currentIndex = -1;
    return undefined;
  }

  clear(): void {
    this.entries = [];
    this.currentIndex = -1;
    this.save();
  }

  export(): PromptEntry[] {
    return [...this.entries];
  }

  import(entries: PromptEntry[]): void {
    this.entries = entries.slice(-this.maxEntries);
    this.save();
  }

  private save(): void {
    try {
      mkdirSync(this.storageDir, { recursive: true });
      writeFileSync(this.storageFile, JSON.stringify(this.entries, null, 2));
    } catch {
      // ignore write errors
    }
  }

  private load(): void {
    try {
      if (existsSync(this.storageFile)) {
        const data = readFileSync(this.storageFile, 'utf-8');
        const parsed = JSON.parse(data) as Array<{
          id: string;
          prompt: string;
          timestamp: string;
          sessionId?: string;
        }>;
        this.entries = parsed.map(entry => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
      }
    } catch {
      // ignore read/parse errors
    }
  }
}

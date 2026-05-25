import fs from 'fs';
import path from 'path';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export class SessionMemory {
  private messages: Message[] = [];
  private maxMessages: number;
  private sessionId: string;
  private storagePath: string;

  constructor(options?: { maxMessages?: number; sessionId?: string; storageDir?: string }) {
    this.maxMessages = options?.maxMessages ?? 50;
    this.sessionId = options?.sessionId || `session_${Date.now()}`;
    const storageDir = options?.storageDir || path.join(process.cwd(), '.sessions');
    this.storagePath = path.join(storageDir, `session-${this.sessionId}.json`);

    if (options?.storageDir) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    this.load();
  }

  addMessage(message: Message): void {
    this.messages.push(message);
    this.truncateIfNeeded();
  }

  addMessages(messages: Message[]): void {
    for (const msg of messages) {
      this.addMessage(msg);
    }
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getLastMessage(): Message | undefined {
    return this.messages[this.messages.length - 1];
  }

  clear(): void {
    this.messages = [];
  }

  size(): number {
    return this.messages.length;
  }

  save(): void {
    const dir = path.dirname(this.storagePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.storagePath, JSON.stringify(this.messages, null, 2));
  }

  load(): void {
    if (fs.existsSync(this.storagePath)) {
      try {
        const data = fs.readFileSync(this.storagePath, 'utf-8');
        this.messages = JSON.parse(data);
      } catch {
        this.messages = [];
      }
    }
  }

  static listSessions(storageDir: string = path.join(process.cwd(), '.sessions')): { sessionId: string; filePath: string; size: number; modified: Date }[] {
    if (!fs.existsSync(storageDir)) {
      return [];
    }

    return fs.readdirSync(storageDir)
      .filter(f => f.startsWith('session-') && f.endsWith('.json'))
      .map(f => {
        const sessionId = f.replace('session-', '').replace('.json', '');
        const filePath = path.join(storageDir, f);
        const stats = fs.statSync(filePath);
        const data = fs.readFileSync(filePath, 'utf-8');
        const messages = JSON.parse(data);
        return { sessionId, filePath, size: messages.length, modified: stats.mtime };
      });
  }

  deleteSession(sessionId: string): void {
    const storageDir = path.dirname(this.storagePath);
    const filePath = path.join(storageDir, `session-${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  clearAll(): void {
    const storageDir = path.dirname(this.storagePath);
    if (fs.existsSync(storageDir)) {
      fs.readdirSync(storageDir)
        .filter(f => f.startsWith('session-') && f.endsWith('.json'))
        .forEach(f => fs.unlinkSync(path.join(storageDir, f)));
    }
    this.messages = [];
  }

  exportSession(): Message[] {
    return JSON.parse(JSON.stringify(this.messages));
  }

  importSession(messages: Message[]): void {
    this.messages = messages.slice(0, this.maxMessages);
  }

  private truncateIfNeeded(): void {
    while (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }
}

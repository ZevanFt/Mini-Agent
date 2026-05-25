import fs from 'fs';
import path from 'path';

export interface Checkpoint {
  id: string;
  timestamp: Date;
  files: Map<string, string>;
  messageCount: number;
  description?: string;
}

export interface CheckpointOptions {
  workingDirectory: string;
  storageDir?: string;
  maxCheckpoints?: number;
}

export type RewindMode = 'code' | 'conversation' | 'both';

interface SerializedCheckpoint {
  id: string;
  timestamp: string;
  files: Record<string, string>;
  messageCount: number;
  description?: string;
}

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `chk_${ts}${rand}`;
}

export class CheckpointManager {
  private workingDirectory: string;
  private storageDir: string;
  private maxCheckpoints: number;
  private checkpoints: Checkpoint[] = [];

  constructor(options: CheckpointOptions) {
    this.workingDirectory = options.workingDirectory;
    this.storageDir = options.storageDir || path.join(process.env.HOME || '.', '.miniagent', 'checkpoints');
    this.maxCheckpoints = options.maxCheckpoints || 50;
    fs.mkdirSync(this.storageDir, { recursive: true });
    this.load();
  }

  create(filePaths: string[], messageCount: number, description?: string): Checkpoint {
    const files = new Map<string, string>();

    for (const filePath of filePaths) {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDirectory, filePath);
      try {
        if (fs.existsSync(absolutePath)) {
          const content = fs.readFileSync(absolutePath, 'utf-8');
          files.set(filePath, content);
        } else {
          files.set(filePath, '');
        }
      } catch {
        files.set(filePath, '');
      }
    }

    const checkpoint: Checkpoint = {
      id: generateId(),
      timestamp: new Date(),
      files,
      messageCount,
      description,
    };

    this.checkpoints.push(checkpoint);

    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints = this.checkpoints.slice(this.checkpoints.length - this.maxCheckpoints);
    }

    this.save();

    return checkpoint;
  }

  list(): Checkpoint[] {
    return [...this.checkpoints];
  }

  get(id: string): Checkpoint | undefined {
    return this.checkpoints.find(cp => cp.id === id);
  }

  async rewind(checkpointId: string, mode: RewindMode = 'code'): Promise<{ restored: string[]; checkpoint: Checkpoint }> {
    const checkpoint = this.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const restored: string[] = [];

    if (mode === 'code' || mode === 'both') {
      for (const [filePath, content] of checkpoint.files) {
        const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.workingDirectory, filePath);

        try {
          const dir = path.dirname(absolutePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          if (content === '' && !fs.existsSync(absolutePath)) {
            fs.writeFileSync(absolutePath, '', 'utf-8');
          } else {
            fs.writeFileSync(absolutePath, content, 'utf-8');
          }

          restored.push(filePath);
        } catch {
          // skip files that cannot be restored
        }
      }
    }

    return { restored, checkpoint };
  }

  delete(id: string): boolean {
    const index = this.checkpoints.findIndex(cp => cp.id === id);
    if (index === -1) {
      return false;
    }

    this.checkpoints.splice(index, 1);
    this.save();
    return true;
  }

  clear(): void {
    this.checkpoints = [];
    this.save();
  }

  private save(): void {
    const serialized: SerializedCheckpoint[] = this.checkpoints.map(cp => ({
      id: cp.id,
      timestamp: cp.timestamp.toISOString(),
      files: Object.fromEntries(cp.files),
      messageCount: cp.messageCount,
      description: cp.description,
    }));

    const filePath = path.join(this.storageDir, 'checkpoints.json');
    fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
  }

  private load(): void {
    const filePath = path.join(this.storageDir, 'checkpoints.json');

    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const serialized: SerializedCheckpoint[] = JSON.parse(raw);

      this.checkpoints = serialized.map(s => ({
        id: s.id,
        timestamp: new Date(s.timestamp),
        files: new Map(Object.entries(s.files)),
        messageCount: s.messageCount,
        description: s.description,
      }));
    } catch {
      this.checkpoints = [];
    }
  }
}

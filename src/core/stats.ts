import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface StatsSnapshot {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalMessages: number;
  totalToolCalls: number;
  totalToolSuccess: number;
  totalToolFailed: number;
  estimatedTokens: number;
  toolBreakdown: Record<string, number>;
}

export interface SessionStats {
  currentSession: StatsSnapshot;
  totalSessions: number;
  averageSessionDuration: number;
  totalToolCallsAllTime: number;
}

export class StatsTracker {
  private current: StatsSnapshot;
  private history: StatsSnapshot[] = [];
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(process.env.HOME || '', '.miniagent', 'stats');
    this.current = this.createSnapshot();
    this.load();
  }

  recordToolCall(toolName: string, success: boolean): void {
    this.current.totalToolCalls++;
    if (success) {
      this.current.totalToolSuccess++;
    } else {
      this.current.totalToolFailed++;
    }
    this.current.toolBreakdown[toolName] = (this.current.toolBreakdown[toolName] || 0) + 1;
  }

  recordMessage(): void {
    this.current.totalMessages++;
  }

  estimateTokens(messageCount: number): number {
    return messageCount * 150;
  }

  getCurrentStats(): StatsSnapshot {
    return { ...this.current };
  }

  getHistory(count?: number): StatsSnapshot[] {
    const sorted = [...this.history].sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    return count ? sorted.slice(0, count) : sorted;
  }

  getSessionStats(): SessionStats {
    const completedSessions = this.history.filter(s => s.endTime);
    const totalSessions = completedSessions.length + 1;
    const totalDuration = completedSessions.reduce((sum, s) => {
      if (s.endTime) {
        return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime());
      }
      return sum;
    }, 0);
    const totalToolCallsAllTime = this.history.reduce((sum, s) => sum + s.totalToolCalls, 0) + this.current.totalToolCalls;

    return {
      currentSession: this.current,
      totalSessions,
      averageSessionDuration: completedSessions.length > 0 ? totalDuration / completedSessions.length : 0,
      totalToolCallsAllTime,
    };
  }

  endSession(): void {
    this.current.endTime = new Date();
    this.history.push({ ...this.current });
    this.save();
    this.current = this.createSnapshot();
  }

  exportReport(): string {
    const stats = this.getSessionStats();
    const lines: string[] = [];
    lines.push('=== Usage Statistics Report ===');
    lines.push('');
    lines.push(`Session ID: ${this.current.sessionId}`);
    lines.push(`Started: ${this.current.startTime.toLocaleString()}`);
    lines.push(`Messages: ${this.current.totalMessages}`);
    lines.push(`Tool calls: ${this.current.totalToolCalls} (success: ${this.current.totalToolSuccess}, failed: ${this.current.totalToolFailed})`);
    lines.push(`Estimated tokens: ~${this.current.estimatedTokens}`);
    lines.push('');

    if (Object.keys(this.current.toolBreakdown).length > 0) {
      lines.push('Tool breakdown (current session):');
      for (const [tool, count] of Object.entries(this.current.toolBreakdown)) {
        lines.push(`  ${tool}: ${count}`);
      }
      lines.push('');
    }

    lines.push(`Total sessions: ${stats.totalSessions}`);
    lines.push(`Average session duration: ${Math.round(stats.averageSessionDuration / 1000 / 60)} minutes`);
    lines.push(`Total tool calls (all time): ${stats.totalToolCallsAllTime}`);

    const recent = this.getHistory(5);
    if (recent.length > 0) {
      lines.push('');
      lines.push('Recent sessions:');
      for (const s of recent) {
        const duration = s.endTime
          ? `${Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 1000 / 60)}m`
          : 'active';
        lines.push(`  ${s.sessionId.slice(0, 8)} | ${s.totalMessages} msg | ${s.totalToolCalls} tools | ${duration}`);
      }
    }

    return lines.join('\n');
  }

  private save(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      const data = this.history.map(s => ({
        ...s,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime?.toISOString(),
      }));
      fs.writeFileSync(path.join(this.storageDir, 'history.json'), JSON.stringify(data, null, 2));
    } catch {
    }
  }

  private load(): void {
    try {
      const filePath = path.join(this.storageDir, 'history.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw) as Array<Record<string, unknown>>;
        this.history = data.map((d) => ({
          sessionId: d.sessionId as string,
          startTime: new Date(d.startTime as string),
          endTime: d.endTime ? new Date(d.endTime as string) : undefined,
          totalMessages: d.totalMessages as number,
          totalToolCalls: d.totalToolCalls as number,
          totalToolSuccess: d.totalToolSuccess as number,
          totalToolFailed: d.totalToolFailed as number,
          estimatedTokens: d.estimatedTokens as number,
          toolBreakdown: d.toolBreakdown as Record<string, number>,
        }));
      }
    } catch {
    }
  }

  private createSnapshot(): StatsSnapshot {
    return {
      sessionId: randomUUID().slice(0, 8),
      startTime: new Date(),
      totalMessages: 0,
      totalToolCalls: 0,
      totalToolSuccess: 0,
      totalToolFailed: 0,
      estimatedTokens: 0,
      toolBreakdown: {},
    };
  }
}

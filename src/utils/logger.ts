import fs from 'fs';
import path from 'path';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

let logStream: fs.WriteStream | null = null;
let isTuiMode = false;

export function setupTuiLogging(logDir: string): string {
  isTuiMode = true;
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, 'miniagent.log');
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  return logPath;
}

export function disableTuiLogging(): void {
  isTuiMode = false;
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

function log(level: LogLevel, ...args: unknown[]) {
  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const message = `${prefix} ${args.join(' ')}\n`;

    // Always write to file if TUI mode
    if (logStream) {
      logStream.write(message);
    }

    // Never write to stderr in TUI mode
    if (!isTuiMode) {
      process.stderr.write(message);
    }
  }
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};

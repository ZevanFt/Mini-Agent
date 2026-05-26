const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function log(level: LogLevel, ...args: unknown[]) {
  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    // Always use stderr to avoid polluting TUI output
    if (level === 'error') {
      process.stderr.write(`${prefix} ${args.join(' ')}\n`);
    } else if (level === 'warn') {
      process.stderr.write(`${prefix} ${args.join(' ')}\n`);
    } else {
      process.stderr.write(`${prefix} ${args.join(' ')}\n`);
    }
  }
}

export const logger = {
  debug: (...args: unknown[]) => log('debug', ...args),
  info: (...args: unknown[]) => log('info', ...args),
  warn: (...args: unknown[]) => log('warn', ...args),
  error: (...args: unknown[]) => log('error', ...args),
};

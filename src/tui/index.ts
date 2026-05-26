import type { Agent } from '../core/agent.js';
import termkit from 'terminal-kit';

const term = termkit.terminal;
const VERSION = '0.2.0';

export interface TUIConfig {
  agent: Agent;
  model: string;
}

export interface TUIHandle {
  start: () => void;
  waitForExit: () => Promise<void>;
  stop: () => void;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
}

let running = false;
let destroyed = false;

const messages: ChatMessage[] = [];
let currentModel = '';

let resolveExit: (() => void) | null = null;
let exitPromise: Promise<void> | null = null;

export async function initTUI(_config: TUIConfig): Promise<TUIHandle> {
  exitPromise = new Promise((resolve) => { resolveExit = resolve; });
  return {
    start: () => startTUI(_config),
    waitForExit: async () => { await exitPromise; },
    stop: () => destroyTUI(),
  };
}

function startTUI(config: TUIConfig): void {
  if (running) return;
  running = true;
  currentModel = config.model;

  term.fullscreen(true);
  term.grabInput({ mouse: 'button' });
  term.clear();

  drawHeader();

  // ctrl+c -> clean exit of TUI only (not the process)
  term.on('key', (name: string) => {
    if (name === 'CTRL_C') destroyTUI();
  });

  setImmediate(() => replLoop(config));
}

function drawHeader(): void {
  const bar = '─'.repeat(Math.min(60, term.width));
  const logo = 'MINIAGENT';
  term.bold(` ${logo}  v${VERSION}  |  ${currentModel}\n`);
  term.dim(bar + '\n');
}

/** Redraw the ENTIRE screen from top so the header is always pinned. */
function fullRedraw(): void {
  term.moveTo(1, 1);
  term.eraseDisplayBelow();

  drawHeader();

  // Reserve the last 2 rows so the prompt line never scrolls the header away.
  const maxRows = term.height - 3; // 2 header rows + 1 prompt row
  let used = 2; // header already took 2 rows

  for (const msg of messages) {
    const line = formatMessage(msg);
    const lines = Math.ceil(line.length / (term.width || 80)) + 1;
    if (used + lines > maxRows) break;
    used += lines;
    term(line);
  }

  term('\n> ');
}

function formatMessage(msg: ChatMessage): string {
  switch (msg.role) {
    case 'user':
      return `\x1b[32mYou: ${msg.content}\x1b[0m\n`;
    case 'assistant':
      return `\x1b[90mAgent: ${msg.content}\x1b[0m\n`;
    case 'tool':
      return `\x1b[33m[${msg.content}]\x1b[0m\n`;
    default:
      return `${msg.content}\n`;
  }
}

/* ── REPL loop ───────────────────────────────────── */

function replLoop(config: TUIConfig): void {
  (async () => {
    while (running && !destroyed) {
      const text = await readLine();
      if (!running || destroyed) break;
      if (text === null) { destroyTUI(); break; }
      if (!text.trim()) continue;
      await processMessage(config, text);
    }
    if (!destroyed) destroyTUI();
  })();
}

function readLine(): Promise<string | null> {
  return new Promise((resolve) => {
    term('> ');
    term.inputField(
      { cancelable: true },
      (_err: unknown, input?: string) => {
        resolve(input === undefined ? null : input ?? '');
      },
    );
  });
}

async function processMessage(config: TUIConfig, text: string): Promise<void> {
  messages.push({ role: 'user', content: text });

  // Stream inline (header may temporarily scroll away)
  term.green(`You: ${text}\n`);
  term.gray('Agent: ');

  let response = '';
  try {
    for await (const chunk of config.agent.chat(text)) {
      if (chunk.type === 'content' && chunk.content) {
        response += chunk.content;
        term(chunk.content);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    term.red(`\nError: ${msg}`);
    response = `[Error: ${msg}]`;
  }

  messages.push({ role: 'assistant', content: response || '(empty response)' });

  // Full redraw pins header back to top
  fullRedraw();
}

/* ── Cleanup ─────────────────────────────────────── */

export function destroyTUI(): void {
  if (destroyed) return;
  destroyed = true;
  running = false;
  try {
    term.grabInput(false);
    term.fullscreen(false);
    term('\n');
  } catch {
    // cleanup errors are safe to ignore
  }
  resolveExit?.();
}

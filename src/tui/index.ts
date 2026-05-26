import type { Agent } from '../core/agent.js';
import type { ChatUsage } from '../llm/base.js';
import termkit from 'terminal-kit';
import { getTodos, type TodoItem as TodoItemType } from '../tools/todo.js';

const term = termkit.terminal;
const VERSION = '0.2.0';

const SPINNER_CHARS = '-\\|/';

const LOGO = [
  '███╗   ███╗██╗███╗   ██╗██╗ █████╗  ██████╗ ███████╗███╗   ██╗████████╗',
  '████╗ ████║██║████╗  ██║██║██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝',
  '██╔████╔██║██║██╔██╗ ██║██║███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ',
  '██║╚██╔╝██║██║██║╚██╗██║██║██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ',
  '██║ ╚═╝ ██║██║██║ ╚████║██║██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ',
  '╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ',
];

interface TUIColors {
  user: string;
  assistant: string;
  tool: string;
  thought: string;
  border: string;
  placeholder: string;
  accent: string;
  error: string;
  success: string;
  dim: string;
  panelTitle: string;
  checkboxDone: string;
  checkboxPending: string;
  shortcut: string;
}

interface TUILayout {
  rightPanelWidth: number;
  maxHistoryRows: number;
}

export interface TUIConfig {
  agent: Agent;
  model: string;
  colors?: Partial<TUIColors>;
  layout?: Partial<TUILayout>;
}

interface TUIHandle {
  start: () => void;
  waitForExit: () => Promise<void>;
  stop: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'tool' | 'system' | 'thought';
  content: string;
  timestamp?: number;
}

interface RightPanelData {
  taskTitle: string;
  contextUsage: ChatUsage;
  todos: TodoItemType[];
  model: string;
  mode: string;
}

type TUIMode = 'idle' | 'active';

class TUIManager {
  private agent: Agent;
  private model: string;
  private mode: TUIMode = 'idle';
  private messages: ChatMessage[] = [];
  private cumulativeUsage: ChatUsage = { input: 0, output: 0, total: 0 };
  private inputHistory: string[] = [];
  private running = false;
  private destroyed = false;
  private exitConfirmed = false;
  private resolveExit: (() => void) | null = null;
  private exitPromise: Promise<void>;
  private colors: TUIColors;
  private layout: TUILayout;
  private spinnerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: TUIConfig) {
    this.agent = config.agent;
    this.model = config.model;

    this.colors = {
      user: '\x1b[32m',
      assistant: '\x1b[90m',
      tool: '\x1b[33m',
      thought: '\x1b[38;5;208m',
      border: '\x1b[90m',
      placeholder: '\x1b[2;37m',
      accent: '\x1b[36m',
      error: '\x1b[31m',
      success: '\x1b[32m',
      dim: '\x1b[2;37m',
      panelTitle: '\x1b[1;36m',
      checkboxDone: '\x1b[32m',
      checkboxPending: '\x1b[33m',
      shortcut: '\x1b[90m',
      ...config.colors,
    };

    this.layout = {
      rightPanelWidth: 30,
      maxHistoryRows: 50,
      ...config.layout,
    };

    this.exitPromise = new Promise((resolve) => { this.resolveExit = resolve; });
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    term.fullscreen(true);
    term.grabInput({ mouse: 'button' });

    term.on('terminal resize', () => {
      if (!this.running) return;
      if (this.mode === 'idle') {
        this.renderIdle();
      } else {
        this.renderActiveLayout(this.getPanelData());
      }
    });

    term.on('key', (name: string) => {
      if (name === 'CTRL_C') {
        if (!this.exitConfirmed) {
          this.exitConfirmed = true;
          this.showExitConfirm();
        } else {
          this.destroy();
        }
      }
    });

    this.mode = 'idle';
    this.renderIdle();
  }

  async waitForExit(): Promise<void> {
    await this.exitPromise;
  }

  stop(): void {
    this.destroy();
  }

  private destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;

    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }

    try {
      term.grabInput(false);
      term.fullscreen(false);
      term('\n');
    } catch {
      // ignore
    }

    this.resolveExit?.();
  }

  private reset(): string {
    return '\x1b[0m';
  }

  private termWidth(): number {
    return term.width || 80;
  }

  private termHeight(): number {
    return term.height || 24;
  }

  private leftWidth(): number {
    return Math.max(40, this.termWidth() - this.layout.rightPanelWidth);
  }

  private showExitConfirm(): void {
    const row = this.termHeight() - 1;
    term.moveTo(1, row);
    term.eraseLine();
    term(`${this.colors.thought}Confirm exit? Press Ctrl+C again${this.reset()}`);
  }

  // ====================  IDLE MODE  ====================

  private renderIdle(): void {
    const w = this.termWidth();
    const h = this.termHeight();

    this.clearScreen();

    const logoH = LOGO.length;
    const logoW = w >= 90 ? 84 : Math.min(84, w - 2);

    // Content layout: logo(6) + gap(1) + subtitle(1) + gap(1) + input_box(3) + tips(2)
    const contentH = logoH + 1 + 1 + 1 + 3 + 2;
    const startRow = Math.max(1, Math.floor((h - contentH) / 2));

    // ---- Logo ----
    for (let i = 0; i < logoH; i++) {
      const line = LOGO[i];
      const col = Math.max(1, Math.floor((w - line.length) / 2));
      term.moveTo(col, startRow + i);
      term(`${this.colors.accent}${line.substring(0, logoW)}${this.reset()}`);
    }

    // ---- Subtitle ----
    const subtitle = 'A local AI Agent framework  |  Built by Zevan';
    const subRow = startRow + logoH + 1;
    const subCol = Math.max(1, Math.floor((w - subtitle.length) / 2));
    term.moveTo(subCol, subRow);
    term(`${this.colors.dim}${subtitle}${this.reset()}`);

    // ---- Input box ----
    const boxWidth = Math.min(52, w - 6);
    const boxCol = Math.max(1, Math.floor((w - boxWidth) / 2));
    const boxRow = subRow + 2;

    // Top border
    term.moveTo(boxCol, boxRow);
    term(`${this.colors.border}+${'-'.repeat(boxWidth - 2)}+${this.reset()}`);

    // Input line
    const prompt = '> Type to start chatting...';
    term.moveTo(boxCol + 2, boxRow + 1);
    term(`${this.colors.placeholder}${prompt}${this.reset()}`);

    // Bottom border
    term.moveTo(boxCol, boxRow + 2);
    term(`${this.colors.border}+${'-'.repeat(boxWidth - 2)}+${this.reset()}`);

    // ---- Tips ----
    const tipsRow = boxRow + 3;
    const tips = [
      '/model  switch model',
      '/plan-mode  toggle plan mode',
    ];
    let maxTipW = 0;
    for (const t of tips) maxTipW = Math.max(maxTipW, t.length);
    const tipsCol = Math.max(1, Math.floor((w - maxTipW) / 2));
    for (let i = 0; i < tips.length; i++) {
      term.moveTo(tipsCol, tipsRow + i);
      term(`${this.colors.dim}${tips[i]}${this.reset()}`);
    }

    // ---- Bottom bar ----
    this.renderBottomBar();

    // ---- Start input ----
    this.startIdleInput(boxCol + 2, boxRow + 1);
  }

  private clearScreen(): void {
    const h = this.termHeight();
    for (let r = 1; r <= h; r++) {
      term.moveTo(1, r);
      term.eraseLine();
    }
  }

  private renderBottomBar(): void {
    const h = this.termHeight();
    const w = this.termWidth();
    const cwd = process.cwd().split('\\').pop() || '';
    const left = `${cwd}  ${this.model}`;
    const right = `v${VERSION}`;

    term.moveTo(1, h);
    term(`${this.colors.dim}${left}${this.reset()}`);

    term.moveTo(w - right.length, h);
    term(`${this.colors.dim}${right}${this.reset()}`);
  }

  private async startIdleInput(col: number, row: number): Promise<void> {
    const text = await this.readInput({ col, row });

    if (!this.running || this.destroyed) return;
    if (text === null) { this.destroy(); return; }
    if (!text.trim()) {
      this.renderIdle();
      return;
    }

    this.pushHistory(text);
    this.mode = 'active';
    await this.processMessage(text);
  }

  // ====================  ACTIVE MODE  ====================

  private async processMessage(text: string): Promise<void> {
    this.messages.push({ role: 'user', content: text, timestamp: Date.now() });

    const panelData = this.getPanelData();
    this.renderActiveLayout(panelData);

    this.startSpinner();

    let response = '';
    try {
      for await (const chunk of this.agent.chat(text)) {
        if (!this.running) break;

        if (chunk.type === 'content' && chunk.content) {
          response += chunk.content;
          this.streamContentToActiveArea(response, panelData);
        }

        if (chunk.usage) {
          this.cumulativeUsage = chunk.usage;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      response += `\n${this.colors.error}Error: ${msg}${this.reset()}`;
    } finally {
      this.stopSpinner();
    }

    if (response) {
      this.messages.push({ role: 'assistant', content: response, timestamp: Date.now() });
    }

    this.renderActiveLayout(this.getPanelData());
    this.waitForNextInput();
  }

  private async waitForNextInput(): Promise<void> {
    const text = await this.readInput({ placeholder: 'Ask anything... ' });

    if (!this.running || this.destroyed) return;
    if (text === null) { this.destroy(); return; }
    if (!text.trim()) {
      this.waitForNextInput();
      return;
    }

    this.pushHistory(text);
    await this.processMessage(text);
  }

  private startSpinner(): void {
    let idx = 0;
    const leftW = this.leftWidth();
    const spinnerRow = this.termHeight() - 2;

    this.spinnerInterval = setInterval(() => {
      if (!this.running) return;
      const ch = SPINNER_CHARS[idx % SPINNER_CHARS.length];
      idx++;
      term.moveTo(leftW + 1, spinnerRow);
      term(`${this.colors.thought}${ch}${this.reset()}`);
    }, 100);
  }

  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    const leftW = this.leftWidth();
    const spinnerRow = this.termHeight() - 2;
    term.moveTo(leftW + 1, spinnerRow);
    term(' ');
  }

  private renderActiveLayout(panelData: RightPanelData): void {
    const w = this.termWidth();
    const h = this.termHeight();
    const leftW = this.leftWidth();

    this.clearScreen();

    term.moveTo(leftW + 1, 1);
    term(`${this.colors.border}|${this.reset()}`);
    for (let row = 2; row < h; row++) {
      term.moveTo(leftW + 1, row);
      term(`${this.colors.border}|${this.reset()}`);
    }

    this.renderRightPanel(panelData, h);

    const title = panelData.taskTitle || 'New Chat';
    term.moveTo(1, 1);
    term(`${this.colors.accent}+ ${title}${this.reset()}`);

    this.renderMessageArea(1, 2, leftW, h - 4);

    this.renderBottomInput(leftW, h, panelData);
  }

  private renderRightPanel(data: RightPanelData, height: number): void {
    const leftW = this.leftWidth();
    let row = 1;

    row = this.renderPanelSection(
      leftW + 2, row,
      'Task',
      [data.taskTitle || 'New Chat'],
    );

    const contextLines = [
      `${this.cumulativeUsage.total.toLocaleString()} tokens`,
      `${this.cumulativeUsage.total > 0 ? Math.round((this.cumulativeUsage.output / Math.max(1, this.cumulativeUsage.total + this.cumulativeUsage.input)) * 100) : 0}% used`,
    ];
    row = this.renderPanelSection(leftW + 2, row, 'Context', contextLines);

    const modelLines = [this.model, 'Plan mode'];
    row = this.renderPanelSection(leftW + 2, row, 'Model', modelLines);

    const shortcutLines = [
      `${this.colors.shortcut}tab: agents${this.reset()}`,
      `${this.colors.shortcut}ctrl+p: commands${this.reset()}`,
    ];
    row = this.renderPanelSection(leftW + 2, row, 'Shortcuts', shortcutLines);

    const todos = getTodos();
    const remainingRows = Math.max(1, height - row - 1);
    this.renderTodoSection(leftW + 2, row, remainingRows, todos);
  }

  private renderPanelSection(col: number, startRow: number, title: string, lines: string[]): number {
    term.moveTo(col, startRow);
    term(`${this.colors.panelTitle}${title}${this.reset()}`);

    lines.forEach((line, i) => {
      term.moveTo(col, startRow + 1 + i);
      term(`${this.colors.dim}  ${line}${this.reset()}`);
    });

    return startRow + 1 + lines.length + 1;
  }

  private renderTodoSection(col: number, startRow: number, maxRows: number, todos: TodoItemType[]): void {
    term.moveTo(col, startRow);
    term(`${this.colors.panelTitle}Todo List${this.reset()}`);

    if (todos.length === 0) {
      term.moveTo(col, startRow + 1);
      term(`${this.colors.dim}  (none)${this.reset()}`);
      return;
    }

    let row = startRow + 1;
    for (const todo of todos) {
      if (row >= startRow + maxRows) break;
      term.moveTo(col, row);
      const checked = todo.status === 'completed';
      const mark = checked
        ? `${this.colors.checkboxDone}[x]${this.reset()}`
        : `${this.colors.checkboxPending}[ ]${this.reset()}`;
      term(`${mark} ${todo.content}`);
      row++;
    }

    if (todos.length > maxRows - 1) {
      term.moveTo(col, startRow + maxRows - 1);
      term(`${this.colors.dim}  ... +${todos.length - maxRows + 1} more${this.reset()}`);
    }
  }

  private renderMessageArea(col: number, startRow: number, width: number, height: number): void {
    let row = startRow;
    const maxRows = height;
    const visible = this.messages.slice(-maxRows);

    for (const msg of visible) {
      if (row > startRow + maxRows - 3) break;
      const lines = this.formatMessage(msg, width).split('\n');
      if (row + lines.length > startRow + maxRows - 2) break;

      for (const line of lines) {
        term.moveTo(col, row);
        term(line);
        row++;
      }
      row++;
    }
  }

  private formatMessage(msg: ChatMessage, width: number): string {
    const R = this.reset();
    switch (msg.role) {
      case 'user':
        return `${this.colors.user}You: ${msg.content}${R}`;
      case 'assistant':
        return `${this.colors.assistant}${this.processAssistantContent(msg.content, width)}${R}`;
      case 'thought':
        return `${this.colors.thought}Thought: ${msg.content}${R}`;
      case 'tool':
        return `${this.colors.tool}[${msg.content}]${R}`;
      default:
        return msg.content;
    }
  }

  private processAssistantContent(content: string, width: number): string {
    return content.split('\n').map(line => {
      if (line.startsWith('+ Thought:')) {
        return `${this.colors.thought}${this.truncate(line, width - 2)}${this.reset()}`;
      }
      return line;
    }).join('\n');
  }

  private renderBottomInput(leftW: number, height: number, _panelData: RightPanelData): void {
    const statusRow = height;
    const inputRow = height - 1;

    term.moveTo(1, inputRow);
    term(`${this.colors.accent}> ${this.reset()}${this.colors.placeholder}Ask anything...${this.reset()}`);

    const shortcuts = `${this.colors.shortcut}ctrl+p commands${this.reset()}`;
    const scCol = Math.max(1, leftW - shortcuts.length - 2);
    term.moveTo(scCol, inputRow);
    term(shortcuts);

    const modeLabel = `${this.colors.accent}Plan${this.reset()} ${this.colors.dim}| ${this.model}${this.reset()}`;
    term.moveTo(1, statusRow);
    term(modeLabel);

    const usageText = `${this.cumulativeUsage.total.toLocaleString()} tokens`;
    term.moveTo(leftW - usageText.length - 2, statusRow);
    term(`${this.colors.dim}${usageText}${this.reset()}`);

    const cwd = process.cwd().split('\\').pop() || '';
    term.moveTo(leftW - cwd.length - usageText.length - 12, statusRow);
    term(`${this.colors.dim}${cwd}${this.reset()}`);

    term.moveTo(Math.max(1, leftW - 6), statusRow);
    term(`${this.colors.dim}v${VERSION}${this.reset()}`);
  }

  private streamContentToActiveArea(content: string, _panelData: RightPanelData): void {
    const h = this.termHeight();
    const leftW = this.leftWidth();
    const headerRows = 1;
    const inputRows = 2;
    const maxRows = h - headerRows - inputRows - 1;

    const lines = content.split('\n').slice(-maxRows);
    const startRow = headerRows + 1;

    for (let i = 0; i < Math.min(lines.length, maxRows); i++) {
      term.moveTo(2, startRow + i);
      term(`${this.colors.assistant}${this.truncate(lines[i], leftW - 4)}${this.reset()}`);
    }
  }

  private async readInput(options: { col?: number; row?: number; placeholder?: string }): Promise<string | null> {
    return new Promise((resolve) => {
      const opts: Record<string, unknown> = {
        cancelable: true,
        history: this.inputHistory,
        historyFilter: (input: string) => input.trim().length > 0,
        placeholder: options.placeholder || '',
        style: this.colors.accent,
      };

      if (options.col !== undefined && options.row !== undefined) {
        term.moveTo(options.col, options.row);
      }

      term.inputField(opts, (_err: unknown, input?: string) => {
        resolve(input === undefined ? null : (input || ''));
      });
    });
  }

  private pushHistory(text: string): void {
    if (text.trim().length > 0) {
      this.inputHistory.unshift(text);
      if (this.inputHistory.length > 50) {
        this.inputHistory = this.inputHistory.slice(0, 50);
      }
    }
  }

  private truncate(text: string, maxLen: number): string {
    const plainLen = text.replace(/\x1b\[[0-9;]*m/g, '').length;
    if (plainLen <= maxLen) return text;

    let result = '';
    let visualLen = 0;
    let inEscape = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\x1b') inEscape = true;
      if (inEscape) {
        result += ch;
        if (ch === 'm') inEscape = false;
        continue;
      }
      if (visualLen >= maxLen - 1) {
        result += '...';
        break;
      }
      result += ch;
      visualLen++;
    }
    return result;
  }

  private getPanelData(): RightPanelData {
    return {
      taskTitle: this.messages.length > 0
        ? this.messages[0].content.substring(0, 28)
        : 'New Chat',
      contextUsage: this.cumulativeUsage,
      todos: getTodos(),
      model: this.model,
      mode: 'Plan',
    };
  }
}

export async function initTUI(config: TUIConfig): Promise<TUIHandle> {
  const manager = new TUIManager(config);
  return {
    start: () => manager.start(),
    waitForExit: async () => { await manager.waitForExit(); },
    stop: () => manager.stop(),
  };
}

export function destroyTUI(): void {
  term.grabInput(false);
  term.fullscreen(false);
  try { term('\n'); } catch { /* ignore */ }
}
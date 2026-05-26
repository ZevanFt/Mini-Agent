import type { Agent } from '../core/agent.js';
import type { ChatChunk, ChatUsage } from '../llm/base.js';
import termkit from 'terminal-kit';
import { getTodos, type TodoItem as TodoItemType } from '../tools/todo.js';
import { logger } from '../utils/logger.js';

const term = termkit.terminal;
const VERSION = '0.2.0';

const ASCII_LOGO = [
  ' ███╗   ███╗██╗███╗   ██╗██╗████████╗ ██████╗  █████╗ ███╗   ██╗',
  ' ████╗ ████║██║████╗  ██║██║╚══██╔══╝██╔═══██╗██╔══██╗████╗  ██║',
  ' ██╔████╔██║██║██╔██╗ ██║██║   ██║   ██║   ██║███████║██╔██╗ ██║',
  ' ██║╚██╔╝██║██║██║╚██╗██║██║   ██║   ██║   ██║██══██║██║╚██╗██║',
  ' ██║ ╚═╝ ██║██║██║ ╚████║██║   ██║   ╚██████╔╝██║  ██║██║ ╚████║',
  ' ╚═╝     ═╝╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝',
];

const SPINNER_CHARS = '⠋⠙⠸⠼⠴⠧⠇⠏';

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

interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
  success: boolean;
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
  private toolCalls: ToolCallRecord[] = [];
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

    logger.info('[TUI] Initialized with model:', this.model);
    logger.info('[TUI] Layout:', this.layout);
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    term.fullscreen(true);
    term.grabInput({ mouse: 'button' });

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

    logger.info('[TUI] Started, mode:', this.mode);
    this.mode = 'idle';
    this.renderIdle();
  }

  async waitForExit(): Promise<void> {
    await this.exitPromise;
    logger.info('[TUI] Exited');
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
    } catch (e) {
      logger.warn('[TUI] Cleanup warning:', e);
    }

    this.resolveExit?.();
  }

  private getColor(code: string): string {
    return code;
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
    const col = 1;
    term.moveTo(col, row);
    term.eraseLine();
    term(`${this.colors.thought}确定退出吗？再按一次 Ctrl+C 确认 (y/n): ${this.reset()}`);
  }

  private hideExitConfirm(): void {
    const row = this.termHeight() - 1;
    term.moveTo(1, row);
    term.eraseLine();
  }

  /* ── Idle Mode (起始页) ──────────────────────────── */

  private renderIdle(): void {
    term.clear();
    const w = this.termWidth();
    const h = this.termHeight();

    const logoWidth = ASCII_LOGO[0].length;
    const logoStartCol = Math.max(1, Math.floor((w - logoWidth) / 2));
    const logoStartRow = Math.max(1, Math.floor(h / 2) - 6);

    term.moveTo(1, 1);
    for (let i = 0; i < ASCII_LOGO.length; i++) {
      term.moveTo(logoStartCol, logoStartRow + i);
      term(`${this.colors.accent}${ASCII_LOGO[i]}${this.reset()}`);
    }

    const subtitle = `面向个人开发者的极简本地 Agent 框架`;
    const subCol = Math.max(1, Math.floor((w - subtitle.length) / 2));
    term.moveTo(subCol, logoStartRow + ASCII_LOGO.length + 1);
    term(`${this.colors.dim}${subtitle}${this.reset()}`);

    const inputRow = logoStartRow + ASCII_LOGO.length + 4;
    term.moveTo(1, inputRow);
    const inputPrompt = `${this.colors.placeholder}Ask anything... "What is the tech stack of this project?"${this.reset()}`;
    term(inputPrompt);

    const modelRow = inputRow + 2;
    term.moveTo(1, modelRow);
    term(`${this.colors.accent}Plan${this.reset()} ${this.colors.dim}• ${this.model}${this.reset()}`);

    const tipsRow = modelRow + 3;
    const tips = [
      `${this.colors.accent}💡 Tips:${this.reset()}`,
      `  输入问题开始对话`,
      `  使用 /model 切换模型`,
      `  使用 /plan-mode 切换规划模式`,
    ];
    tips.forEach((tip, i) => {
      term.moveTo(1, tipsRow + i);
      term(tip);
    });

    this.renderBottomBar();
    term('\n');

    this.startIdleInput(inputRow, logoStartRow, modelRow, tipsRow);
  }

  private async startIdleInput(inputRow: number, logoRow: number, modelRow: number, tipsRow: number): Promise<void> {
    const w = this.termWidth();
    const inputCol = 1;

    logger.info('[TUI] Idle mode waiting for input');

    const text = await this.readInput({
      placeholder: 'Ask anything... ',
      style: {
        prefix: `${this.colors.accent}› ${this.reset()}`,
        suffix: '',
      },
    });

    if (!this.running || this.destroyed) return;
    if (text === null) { this.destroy(); return; }
    if (!text.trim()) {
      this.renderIdle();
      return;
    }

    this.pushHistory(text);
    this.mode = 'active';
    logger.info('[TUI] Switched to active mode');
    await this.processMessage(text);
  }

  /* ── Active Mode (对话模式) ───────────────────────── */

  private async processMessage(text: string): Promise<void> {
    this.messages.push({ role: 'user', content: text, timestamp: Date.now() });
    this.toolCalls = [];

    logger.info('[TUI] User message:', text.substring(0, 80));

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
      logger.error('[TUI] Agent error:', msg);
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
    const panelData = this.getPanelData();

    const text = await this.readInput({
      placeholder: 'Ask anything... ',
      style: {
        prefix: `${this.colors.accent}› ${this.reset()}`,
        suffix: '',
      },
    });

    if (!this.running || this.destroyed) return;
    if (text === null) { this.destroy(); return; }
    if (!text.trim()) {
      this.waitForNextInput();
      return;
    }

    this.pushHistory(text);
    await this.processMessage(text);
  }

  /* ── Spinner ─────────────────────────────────────── */

  private startSpinner(): void {
    let idx = 0;
    const leftW = this.leftWidth();
    const bottomInputRow = this.termHeight() - 2;

    this.spinnerInterval = setInterval(() => {
      if (!this.running) return;
      const char = SPINNER_CHARS[idx % SPINNER_CHARS.length];
      idx++;
      term.moveTo(leftW + 1, bottomInputRow);
      term(`${this.colors.thought}${char}${this.reset()}`);
    }, 100);
  }

  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    const leftW = this.leftWidth();
    const bottomInputRow = this.termHeight() - 2;
    term.moveTo(leftW + 1, bottomInputRow);
    term(' ');
  }

  /* ── Rendering ───────────────────────────────────── */

  private renderActiveLayout(panelData: RightPanelData): void {
    term.clear();

    const w = this.termWidth();
    const h = this.termHeight();
    const leftW = this.leftWidth();
    const rightW = this.layout.rightPanelWidth;

    const headerRows = 1;
    const inputRows = 2;
    const bottomRow = h;
    const messageAreaRows = h - headerRows - inputRows - 1;

    for (let row = 1; row <= h; row++) {
      term.moveTo(1, row);
      term.eraseLine();
    }

    term.moveTo(leftW + 1, 1);
    term(`${this.colors.border}│${this.reset()}`);
    for (let row = 2; row < h; row++) {
      term.moveTo(leftW + 1, row);
      term(`${this.colors.border}│${this.reset()}`);
    }

    this.renderRightPanel(panelData, rightW, h);

    const title = panelData.taskTitle || 'New Chat';
    term.moveTo(1, 1);
    term(`${this.colors.accent}+ ${title}${this.reset()}`);

    this.renderMessageArea(1, headerRows + 1, leftW, messageAreaRows);

    this.renderBottomInput(leftW, h, panelData);
  }

  private renderRightPanel(data: RightPanelData, width: number, height: number): void {
    const leftW = this.leftWidth();
    let row = 1;

    row = this.renderPanelSection(
      leftW + 2, row, width - 1,
      'Task',
      [data.taskTitle || 'New Chat'],
    );

    const contextLines = [
      `${this.cumulativeUsage.total.toLocaleString()} tokens`,
      `${this.cumulativeUsage.total > 0 ? Math.round((this.cumulativeUsage.output / Math.max(1, this.cumulativeUsage.total + this.cumulativeUsage.input)) * 100) : 0}% used`,
    ];
    row = this.renderPanelSection(leftW + 2, row, width - 1, 'Context', contextLines);

    const modelLines = [
      this.model,
      'Plan mode',
    ];
    row = this.renderPanelSection(leftW + 2, row, width - 1, 'Model', modelLines);

    const shortcutLines = [
      `${this.colors.shortcut}tab: agents${this.reset()}`,
      `${this.colors.shortcut}ctrl+p: commands${this.reset()}`,
    ];
    row = this.renderPanelSection(leftW + 2, row, width - 1, 'Shortcuts', shortcutLines);

    const todos = getTodos();
    const remainingRows = Math.max(1, height - row - 1);
    this.renderTodoSection(leftW + 2, row, width - 1, remainingRows, todos);
  }

  private renderPanelSection(col: number, startRow: number, width: number, title: string, lines: string[]): number {
    term.moveTo(col, startRow);
    term(`${this.colors.panelTitle} ${title}${this.reset()}`);

    lines.forEach((line, i) => {
      term.moveTo(col + 1, startRow + 1 + i);
      term(`${this.colors.dim}${this.truncate(line, width - 2)}${this.reset()}`);
    });

    const totalRows = 1 + lines.length + 1;
    return startRow + totalRows;
  }

  private renderTodoSection(col: number, startRow: number, width: number, maxRows: number, todos: TodoItemType[]): void {
    term.moveTo(col, startRow);
    term(`${this.colors.panelTitle} Todo List${this.reset()}`);

    if (todos.length === 0) {
      term.moveTo(col + 1, startRow + 1);
      term(`${this.colors.dim}(none)${this.reset()}`);
      return;
    }

    let row = startRow + 1;
    for (const todo of todos) {
      if (row >= startRow + maxRows) break;
      term.moveTo(col + 1, row);
      const checked = todo.status === 'completed';
      const mark = checked
        ? `${this.colors.checkboxDone}☑${this.reset()}`
        : `${this.colors.checkboxPending}☐${this.reset()}`;
      const text = this.truncate(`${mark} ${todo.content}`, width - 2);
      term(text);
      row++;
    }

    if (todos.length > maxRows - 1) {
      term.moveTo(col + 1, startRow + maxRows - 1);
      term(`${this.colors.dim}... +${todos.length - maxRows + 1} more${this.reset()}`);
    }
  }

  private renderMessageArea(col: number, startRow: number, width: number, height: number): void {
    const maxRows = height;
    let row = startRow;
    const visibleMessages = this.messages.slice(-maxRows);

    for (const msg of visibleMessages) {
      if (row > startRow + maxRows - 3) break;
      const formatted = this.formatMessage(msg, width);
      const msgLines = formatted.split('\n');
      const msgRowHeight = msgLines.length;

      if (row + msgRowHeight > startRow + maxRows - 2) break;

      for (const line of msgLines) {
        term.moveTo(col, row);
        term(line);
        row++;
      }
      row++;
    }
  }

  private formatMessage(msg: ChatMessage, width: number): string {
    const reset = this.reset();
    switch (msg.role) {
      case 'user':
        return `${this.colors.user}You: ${msg.content}${reset}`;
      case 'assistant': {
        const processed = this.processAssistantContent(msg.content, width);
        return `${this.colors.assistant}${processed}${reset}`;
      }
      case 'thought':
        return `${this.colors.thought}Thought: ${msg.content}${reset}`;
      case 'tool':
        return `${this.colors.tool}[${msg.content}]${reset}`;
      default:
        return msg.content;
    }
  }

  private processAssistantContent(content: string, width: number): string {
    const lines = content.split('\n');
    const processed: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+ Thought:')) {
        processed.push(`${this.colors.thought}${this.truncate(line, width - 2)}${this.reset()}`);
      } else if (line.startsWith('```')) {
        processed.push(line);
      } else {
        processed.push(line);
      }
    }

    return processed.join('\n');
  }

  private renderBottomInput(leftW: number, height: number, panelData: RightPanelData): void {
    const statusRow = height;
    const inputRow = height - 1;

    term.moveTo(1, inputRow);
    term(`${this.colors.accent}› ${this.reset()}${this.colors.placeholder}Ask anything...${this.reset()}`);

    const modeLabel = 'Plan';
    term.moveTo(1, statusRow);
    term(`${this.colors.accent}${modeLabel}${this.reset()} ${this.colors.dim}• ${this.model}${this.reset()}`);

    const shortcuts = `${this.colors.shortcut}ctrl+p commands${this.reset()}`;
    const shortcutCol = leftW - shortcuts.length - 2;
    if (shortcutCol > 1) {
      term.moveTo(shortcutCol, inputRow);
      term(shortcuts);
    }

    const usageText = `${this.cumulativeUsage.total.toLocaleString()} tokens`;
    const usageCol = leftW - usageText.length - 2;
    if (usageCol > 1 && statusRow) {
      term.moveTo(Math.max(1, usageCol), statusRow);
      term(`${this.colors.dim}${usageText}${this.reset()}`);
    }

    term.moveTo(1, statusRow);
    term(`${this.colors.accent}${modeLabel}${this.reset()} ${this.colors.dim}• ${this.model}${this.reset()}`);

    const cwd = process.cwd().split('\\').pop() || process.cwd();
    const cwdCol = Math.max(1, leftW - cwd.length - 10);
    term.moveTo(cwdCol, statusRow);
    term(`${this.colors.dim}${cwd}${this.reset()}`);

    const verCol = Math.max(1, leftW - 6);
    term.moveTo(verCol, statusRow);
    term(`${this.colors.dim}v${VERSION}${this.reset()}`);
  }

  private renderBottomBar(): void {
    const h = this.termHeight();
    const w = this.termWidth();
    const cwd = process.cwd().split('\\').pop() || process.cwd();

    term.moveTo(1, h);
    term(`${this.colors.dim}${cwd}:${this.model}${this.reset()}`);

    const verCol = Math.max(1, w - 6);
    term.moveTo(verCol, h);
    term(`${this.colors.dim}v${VERSION}${this.reset()}`);
  }

  private streamContentToActiveArea(content: string, panelData: RightPanelData): void {
    const w = this.termWidth();
    const h = this.termHeight();
    const leftW = this.leftWidth();
    const headerRows = 1;
    const inputRows = 2;
    const maxRows = h - headerRows - inputRows - 1;

    const allLines = content.split('\n');
    const visibleLines = allLines.slice(-maxRows);

    const startRow = headerRows + 1;
    for (let i = 0; i < Math.min(visibleLines.length, maxRows); i++) {
      term.moveTo(2, startRow + i);
      term(`${this.colors.assistant}${this.truncate(visibleLines[i], leftW - 4)}${this.reset()}`);
    }
  }

  /* ── Input ───────────────────────────────────────── */

  private async readInput(options: { placeholder?: string; style?: Record<string, string> }): Promise<string | null> {
    return new Promise((resolve) => {
      const inputOptions: Record<string, unknown> = {
        cancelable: true,
        history: this.inputHistory,
        historyFilter: (input: string) => input.trim().length > 0,
      };

      if (options.placeholder) {
        inputOptions.echo = false;
      }

      term.inputField(inputOptions, (_err: unknown, input?: string) => {
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

  /* ─ Helpers ─────────────────────────────────────── */

  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen - 1) + '…';
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

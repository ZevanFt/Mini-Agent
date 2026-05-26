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
  '██║ ╚═╝ ██║██║██║ ╚████║██║██║  ██║██████╔╝███████╗██║ ╚████║   ██║   ',
  '╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ═╝   ',
];

interface SlashCommand {
  cmd: string;
  desc: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: '/help',     desc: 'Show help' },
  { cmd: '/compact',  desc: 'Compress context' },
  { cmd: '/clear',    desc: 'Clear conversation' },
  { cmd: '/plan',     desc: 'Toggle plan mode' },
  { cmd: '/model',    desc: 'Switch model' },
  { cmd: '/session',  desc: 'Manage sessions' },
  { cmd: '/review',   desc: 'Review changes' },
  { cmd: '/commit',   desc: 'Generate commit message' },
  { cmd: '/config',   desc: 'Show configuration' },
  { cmd: '/thinking', desc: 'Toggle verbose thinking' },
  { cmd: '/quit',     desc: 'Exit' },
];

type AppMode = 'plan' | 'build';

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
  tabActive: string;
  tabInactive: string;
  slashMenuBg: string;
  slashMenuHighlight: string;
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
  appMode: AppMode;
}

type TUIMode = 'idle' | 'active';

interface SlashMenuState {
  visible: boolean;
  filter: string;
  selected: number;
  col: number;
  row: number;
  width: number;
  height: number;
}

class TUIManager {
  private agent: Agent;
  private model: string;
  private tuiMode: TUIMode = 'idle';
  private appMode: AppMode = 'build';
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
  private slashMenu: SlashMenuState = {
    visible: false,
    filter: '',
    selected: 0,
    col: 0,
    row: 0,
    width: 0,
    height: 0,
  };
  private keyHandler: ((name: string, _matches: unknown, output: unknown[]) => void) | null = null;
  private inputBuffer = '';
  private inputCursor = 0;
  private inputCol = 0;
  private inputRow = 0;
  private inputActive = false;

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
      tabActive: '\x1b[1;36m',
      tabInactive: '\x1b[90m',
      slashMenuBg: '\x1b[48;5;235m',
      slashMenuHighlight: '\x1b[38;5;208m',
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
    term.grabInput(true);

    this.keyHandler = (name: string) => {
      if (!this.running) return;

      if (name === 'CTRL_C') {
        if (!this.exitConfirmed) {
          this.exitConfirmed = true;
          this.showExitConfirm();
        } else {
          this.destroy();
        }
        return;
      }

      if (this.slashMenu.visible) {
        this.handleSlashMenuKey(name);
        return;
      }

      if (this.inputActive) {
        this.handleInputKey(name);
      }
    };

    term.on('key', this.keyHandler);

    term.on('terminal resize', () => {
      if (!this.running) return;
      if (this.slashMenu.visible) {
        this.slashMenu.visible = false;
      }
      if (this.tuiMode === 'idle') {
        this.renderIdle();
      } else {
        this.renderActiveLayout(this.getPanelData());
      }
    });

    this.tuiMode = 'idle';
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
    this.inputActive = false;

    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }

    if (this.keyHandler) {
      term.removeListener('key', this.keyHandler);
      this.keyHandler = null;
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

  // ====================  INPUT HANDLING  ====================

  private handleInputKey(name: string): void {
    if (name === 'ENTER') {
      this.submitInput();
      return;
    }

    if (name === 'BACKSPACE') {
      if (this.inputCursor > 0) {
        this.inputBuffer = this.inputBuffer.slice(0, this.inputCursor - 1) + this.inputBuffer.slice(this.inputCursor);
        this.inputCursor--;
        this.redrawInput();
      }
      return;
    }

    if (name === 'DELETE') {
      if (this.inputCursor < this.inputBuffer.length) {
        this.inputBuffer = this.inputBuffer.slice(0, this.inputCursor) + this.inputBuffer.slice(this.inputCursor + 1);
        this.redrawInput();
      }
      return;
    }

    if (name === 'LEFT') {
      if (this.inputCursor > 0) {
        this.inputCursor--;
        this.moveCursor();
      }
      return;
    }

    if (name === 'RIGHT') {
      if (this.inputCursor < this.inputBuffer.length) {
        this.inputCursor++;
        this.moveCursor();
      }
      return;
    }

    if (name === 'UP') {
      if (this.inputHistory.length > 0) {
        this.inputBuffer = this.inputHistory[0] || '';
        this.inputCursor = this.inputBuffer.length;
        this.redrawInput();
      }
      return;
    }

    if (name === 'TAB') {
      this.appMode = this.appMode === 'plan' ? 'build' : 'plan';
      this.renderTabBar();
      return;
    }

    if (name === 'ESCAPE') {
      this.inputActive = false;
      if (this.tuiMode === 'idle') {
        this.renderIdle();
      } else {
        this.waitForNextInput();
      }
      return;
    }

    if (name === 'CTRL_L') {
      if (this.tuiMode === 'idle') {
        this.renderIdle();
      } else {
        this.renderActiveLayout(this.getPanelData());
      }
      return;
    }

    if (name.length === 1) {
      this.inputBuffer = this.inputBuffer.slice(0, this.inputCursor) + name + this.inputBuffer.slice(this.inputCursor);
      this.inputCursor++;

      // Check for slash command trigger
      if (this.inputBuffer === '/') {
        this.openSlashMenu();
      }

      this.redrawInput();
    }
  }

  private submitInput(): void {
    const text = this.inputBuffer;
    this.inputActive = false;
    this.inputBuffer = '';
    this.inputCursor = 0;

    if (!text.trim()) {
      if (this.tuiMode === 'idle') {
        this.renderIdle();
      } else {
        this.waitForNextInput();
      }
      return;
    }

    this.pushHistory(text);

    if (text.trim().startsWith('/')) {
      const handled = this.handleSlashCommand(text.trim());
      if (handled) {
        if (this.tuiMode === 'idle') {
          this.renderIdle();
        } else {
          this.renderActiveLayout(this.getPanelData());
          this.waitForNextInput();
        }
        return;
      }
    }

    if (this.tuiMode === 'idle') {
      this.tuiMode = 'active';
      this.processMessage(text);
    } else {
      this.processMessage(text);
    }
  }

  private redrawInput(): void {
    if (!this.inputActive) return;
    term.moveTo(this.inputCol, this.inputRow);
    const display = this.inputBuffer || '';
    const remaining = this.termWidth() - this.inputCol + 1;
    const displayText = display.length > remaining ? display.substring(0, remaining - 1) : display;
    term(`${this.colors.accent}${displayText}${this.reset()}`);
    term.eraseLineEnd();
    term.moveTo(this.inputCol + this.inputCursor, this.inputRow);
  }

  private moveCursor(): void {
    term.moveTo(this.inputCol + this.inputCursor, this.inputRow);
  }

  private startInput(col: number, row: number): void {
    this.inputActive = true;
    this.inputCol = col;
    this.inputRow = row;
    this.inputBuffer = '';
    this.inputCursor = 0;
    term.moveTo(col, row);
    term(' ');
    term.moveTo(col, row);
  }

  // ====================  SLASH MENU  ====================

  private openSlashMenu(): void {
    const w = this.termWidth();
    const h = this.termHeight();

    const menuWidth = Math.min(50, w - 4);
    const menuHeight = Math.min(SLASH_COMMANDS.length, h - 10);
    const menuCol = Math.max(2, Math.floor((w - menuWidth) / 2));
    const menuRow = Math.max(2, Math.floor((h - menuHeight - 2) / 2));

    this.slashMenu = {
      visible: true,
      filter: '',
      selected: 0,
      col: menuCol,
      row: menuRow,
      width: menuWidth,
      height: menuHeight,
    };

    this.renderSlashMenu();
  }

  private closeSlashMenu(): void {
    this.slashMenu.visible = false;
    this.slashMenu.filter = '';
    this.slashMenu.selected = 0;
  }

  private handleSlashMenuKey(name: string): void {
    if (name === 'ESCAPE' || name === 'CTRL_C') {
      this.closeSlashMenu();
      this.redrawInput();
      return;
    }

    if (name === 'ENTER') {
      const filtered = this.getFilteredCommands();
      if (filtered.length > 0 && this.slashMenu.selected < filtered.length) {
        const cmd = filtered[this.slashMenu.selected].cmd;
        this.closeSlashMenu();
        this.inputBuffer = cmd;
        this.inputCursor = cmd.length;
        this.redrawInput();
      } else {
        this.closeSlashMenu();
        this.redrawInput();
      }
      return;
    }

    if (name === 'UP') {
      if (this.slashMenu.selected > 0) {
        this.slashMenu.selected--;
        this.renderSlashMenu();
      }
      return;
    }

    if (name === 'DOWN') {
      const filtered = this.getFilteredCommands();
      if (this.slashMenu.selected < filtered.length - 1) {
        this.slashMenu.selected++;
        this.renderSlashMenu();
      }
      return;
    }

    if (name === 'TAB') {
      const filtered = this.getFilteredCommands();
      if (filtered.length > 0) {
        this.slashMenu.selected = (this.slashMenu.selected + 1) % filtered.length;
        this.renderSlashMenu();
      }
      return;
    }

    if (name === 'BACKSPACE') {
      if (this.slashMenu.filter.length > 0) {
        this.slashMenu.filter = this.slashMenu.filter.slice(0, -1);
        this.slashMenu.selected = 0;
        this.renderSlashMenu();
        this.inputBuffer = '/' + this.slashMenu.filter;
        this.inputCursor = this.inputBuffer.length;
        this.redrawInput();
      }
      return;
    }

    if (name.length === 1) {
      this.slashMenu.filter += name;
      this.slashMenu.selected = 0;
      this.renderSlashMenu();
      this.inputBuffer = '/' + this.slashMenu.filter;
      this.inputCursor = this.inputBuffer.length;
      this.redrawInput();
    }
  }

  private getFilteredCommands(): SlashCommand[] {
    if (!this.slashMenu.filter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().includes(this.slashMenu.filter.toLowerCase()));
  }

  private renderSlashMenu(): void {
    const { col, row, width, height } = this.slashMenu;
    const filtered = this.getFilteredCommands();
    const visible = filtered.slice(0, height);

    // Background box
    const bgFill = ' '.repeat(width);
    for (let r = 0; r <= visible.length + 1; r++) {
      term.moveTo(col, row + r);
      term(`${this.colors.slashMenuBg}${bgFill}${this.reset()}`);
    }

    // Border
    const borderFill = '─'.repeat(width);
    term.moveTo(col, row);
    term(`${this.colors.border}${borderFill}${this.reset()}`);
    term.moveTo(col, row + visible.length + 1);
    term(`${this.colors.border}${borderFill}${this.reset()}`);

    // Commands
    visible.forEach((cmd, i) => {
      const isSel = i === this.slashMenu.selected;
      const line = ` ${cmd.cmd.padEnd(15)} ${cmd.desc}`.substring(0, width - 2);
      term.moveTo(col + 1, row + 1 + i);
      if (isSel) {
        term(`${this.colors.slashMenuHighlight}${line}${this.reset()}`);
      } else {
        term(`${this.colors.dim}${line}${this.reset()}`);
      }
    });

    // Redraw input line to clear any leftover characters
    this.redrawInput();
  }

  // ====================  IDLE MODE  ====================

  private renderIdle(): void {
    const w = this.termWidth();
    const h = this.termHeight();

    this.clearScreen();

    const logoH = LOGO.length;
    const logoW = w >= 90 ? 84 : Math.min(84, w - 2);

    const contentH = logoH + 1 + 1 + 2 + 4 + 2;
    const startRow = Math.max(1, Math.floor((h - contentH) / 2));

    // Logo
    for (let i = 0; i < logoH; i++) {
      const line = LOGO[i];
      const col = Math.max(1, Math.floor((w - line.length) / 2));
      term.moveTo(col, startRow + i);
      term(`${this.colors.accent}${line.substring(0, logoW)}${this.reset()}`);
    }

    // Subtitle
    const subtitle = 'A local AI Agent framework  |  Built by Zevan';
    const subRow = startRow + logoH + 1;
    const subCol = Math.max(1, Math.floor((w - subtitle.length) / 2));
    term.moveTo(subCol, subRow);
    term(`${this.colors.dim}${subtitle}${this.reset()}`);

    // Tab bar
    const tabRow = subRow + 2;
    this.renderTabBarAt(tabRow, w);

    // Input box (4 rows)
    const boxWidth = Math.min(76, w - 4);
    const boxCol = Math.max(1, Math.floor((w - boxWidth) / 2));
    const boxRow = tabRow + 2;

    const boxFill = ' '.repeat(boxWidth);
    for (let r = 0; r < 4; r++) {
      term.moveTo(boxCol, boxRow + r);
      term(`\x1b[48;5;236m${boxFill}\x1b[0m`);
    }

    // Left accent
    for (let r = 0; r < 4; r++) {
      term.moveTo(boxCol, boxRow + r);
      term(`\x1b[48;5;24m \x1b[0m`);
    }

    // Row 1: placeholder
    const placeholder = 'Ask anything...  "What is the tech stack of this project?"';
    term.moveTo(boxCol + 2, boxRow);
    term(`\x1b[38;5;102;48;5;236m${placeholder}\x1b[0m`);

    // Row 3: mode + model
    const modeLabel = this.appMode === 'plan' ? 'Plan' : 'Build';
    term.moveTo(boxCol + 2, boxRow + 2);
    term(`${this.colors.accent}${modeLabel}${this.reset()} ${this.colors.dim}· ${this.model}${this.reset()}`);

    // Row 4: bottom border
    const borderCh = '─';
    term.moveTo(boxCol + 2, boxRow + 3);
    term(`\x1b[48;5;236m${this.colors.border}${borderCh.repeat(boxWidth - 3)}${this.reset()}`);

    // Tips below box
    const tipsText = 'tab: switch mode  /: commands  ctrl+p: commands';
    const tipsRow = boxRow + 4;
    const tipsCol = Math.max(1, Math.floor((w - tipsText.length) / 2));
    term.moveTo(tipsCol, tipsRow);
    term(`${this.colors.dim}${tipsText}${this.reset()}`);

    // Bottom bar
    this.renderBottomBar();

    // Start input
    this.startInput(boxCol + 2, boxRow);
  }

  private renderTabBar(): void {
    if (this.tuiMode === 'idle') {
      const h = this.termHeight();
      const contentH = LOGO.length + 1 + 1 + 2 + 4 + 2;
      const startRow = Math.max(1, Math.floor((h - contentH) / 2));
      const subRow = startRow + LOGO.length + 1;
      const tabRow = subRow + 2;
      this.renderTabBarAt(tabRow, this.termWidth());
    }
  }

  private renderTabBarAt(row: number, w: number): void {
    term.moveTo(1, row);
    term.eraseLine();

    const buildActive = this.appMode === 'build';
    const buildLabel = ` ${buildActive ? 'Build' : 'Build'} `;
    const planLabel = ` ${!buildActive ? 'Plan' : 'Plan'} `;
    const sep = ' │ ';

    const totalWidth = buildLabel.length + sep.length + planLabel.length;
    const startCol = Math.max(1, Math.floor((w - totalWidth) / 2));

    term.moveTo(startCol, row);

    // Build tab
    if (buildActive) {
      term(`${this.colors.tabActive}${buildLabel}${this.reset()}`);
    } else {
      term(`${this.colors.tabInactive}${buildLabel}${this.reset()}`);
    }

    // Separator
    term(`${this.colors.dim}${sep}${this.reset()}`);

    // Plan tab
    if (!buildActive) {
      term(`${this.colors.tabActive}${planLabel}${this.reset()}`);
    } else {
      term(`${this.colors.tabInactive}${planLabel}${this.reset()}`);
    }
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
    const cwd = process.cwd();
    const right = `v${VERSION}`;

    term.moveTo(1, h);
    term(`${this.colors.dim}${cwd}${this.reset()}`);

    term.moveTo(w - right.length - 1, h);
    term(`${this.colors.dim}${right}${this.reset()}`);
  }

  // ====================  SLASH COMMANDS  ====================

  private handleSlashCommand(cmd: string): boolean {
    const trimmed = cmd.toLowerCase();
    if (trimmed === '/quit' || trimmed === '/exit') {
      this.destroy();
      return true;
    }
    if (trimmed === '/plan') {
      this.appMode = this.appMode === 'plan' ? 'build' : 'plan';
      process.stderr.write(`[TUI] Switched to ${this.appMode} mode\n`);
      return true;
    }
    if (trimmed === '/model') {
      process.stderr.write('[TUI] /model: cycle models (not yet implemented)\n');
      return true;
    }
    if (trimmed === '/help') {
      process.stderr.write('[TUI] /help: Available commands: ' + SLASH_COMMANDS.map(c => c.cmd).join(', ') + '\n');
      return true;
    }
    if (trimmed === '/clear') {
      this.messages = [];
      this.cumulativeUsage = { input: 0, output: 0, total: 0 };
      process.stderr.write('[TUI] /clear: Conversation cleared\n');
      return true;
    }
    if (trimmed === '/compact') {
      process.stderr.write('[TUI] /compact: Context compression (not yet implemented)\n');
      return true;
    }
    if (trimmed === '/config') {
      process.stderr.write(`[TUI] /config: Model=${this.model}, Mode=${this.appMode}\n`);
      return true;
    }
    return false;
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

  private waitForNextInput(): void {
    const h = this.termHeight();
    const leftW = this.leftWidth();
    const inputRow = h - 2;

    this.startInput(2, inputRow);
  }

  private startSpinner(): void {
    let idx = 0;
    const leftW = this.leftWidth();
    const spinnerRow = this.termHeight() - 3;

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
    const spinnerRow = this.termHeight() - 3;
    term.moveTo(leftW + 1, spinnerRow);
    term(' ');
  }

  private renderActiveLayout(panelData: RightPanelData): void {
    const w = this.termWidth();
    const h = this.termHeight();
    const leftW = this.leftWidth();

    this.clearScreen();

    // Vertical divider
    term.moveTo(leftW + 1, 1);
    term(`${this.colors.border}|${this.reset()}`);
    for (let row = 2; row < h - 1; row++) {
      term.moveTo(leftW + 1, row);
      term(`${this.colors.border}|${this.reset()}`);
    }

    // Tab bar at top
    this.renderTabBarAt(1, leftW);

    this.renderRightPanel(panelData, h);

    const title = panelData.taskTitle || 'New Chat';
    term.moveTo(2, 2);
    term(`${this.colors.accent}+ ${title}${this.reset()}`);

    this.renderMessageArea(2, 3, leftW - 2, h - 6);

    this.renderBottomInput(leftW, h, panelData);
  }

  private renderRightPanel(data: RightPanelData, height: number): void {
    const leftW = this.leftWidth();
    let row = 2;

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

    const modeLabel = data.appMode === 'plan' ? 'Plan mode' : 'Build mode';
    const modelLines = [this.model, modeLabel];
    row = this.renderPanelSection(leftW + 2, row, 'Model', modelLines);

    const shortcutLines = [
      `${this.colors.shortcut}tab: switch mode${this.reset()}`,
      `${this.colors.shortcut}/: commands${this.reset()}`,
    ];
    row = this.renderPanelSection(leftW + 2, row, 'Shortcuts', shortcutLines);

    const todos = getTodos();
    const remainingRows = Math.max(1, height - row - 3);
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

  private renderBottomInput(leftW: number, height: number, panelData: RightPanelData): void {
    const statusRow = height;
    const inputRow = height - 1;

    // Input prompt
    term.moveTo(2, inputRow);
    term(`${this.colors.accent}> ${this.reset()}`);

    const modeLabel = panelData.appMode === 'plan' ? 'Plan' : 'Build';
    term.moveTo(2, statusRow);
    term(`${this.colors.accent}${modeLabel}${this.reset()} ${this.colors.dim}| ${this.model}${this.reset()}`);

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
    const headerRows = 3;
    const inputRows = 2;
    const maxRows = h - headerRows - inputRows - 1;

    const lines = content.split('\n').slice(-maxRows);
    const startRow = headerRows;

    for (let i = 0; i < Math.min(lines.length, maxRows); i++) {
      term.moveTo(3, startRow + i);
      term(`${this.colors.assistant}${this.truncate(lines[i], leftW - 5)}${this.reset()}`);
    }
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
      appMode: this.appMode,
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

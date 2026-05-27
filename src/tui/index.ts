import type { Agent } from '../core/agent.js';
import type { ChatUsage } from '../llm/base.js';
import termkit from 'terminal-kit';
import { getTodos, type TodoItem as TodoItemType } from '../tools/todo.js';

const term = termkit.terminal;
const VERSION = '0.2.0';

const SPINNER_CHARS = '-\\|/';

const LOGO = [
  '███╗   ███╗██╗███╗   ██╗██╗ █████╗  ██████╗ ███████╗███╗   ██╗████████╗',
  '████╗ ████║██║████╗  ██║██║██╔══██╗██╔════╝ ██════╝████╗  ██║══██══╝',
  '██╔██████║██║██╔██╗ ██║██║███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ',
  '██║██╗██║██║██║╚██╗██║██║██══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ',
  '██║ ╚═╝ ██║██║██║ ╚████║██║██║  ██║██████╗███████╗██║ ╚████║   ██║   ',
  '╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝ ═════╝╚═╝  ╚═══╝   ═╝   ',
];

interface SlashCommand {
  cmd: string;
  desc: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  // Core
  { cmd: '/help',     desc: 'Show help' },
  { cmd: '/quit',     desc: 'Exit' },
  { cmd: '/clear',    desc: 'Clear conversation' },
  { cmd: '/compact',  desc: 'Compress context' },
  { cmd: '/thinking', desc: 'Toggle verbose thinking' },
  // Mode
  { cmd: '/plan',     desc: 'Toggle plan mode' },
  { cmd: '/build',    desc: 'Toggle build mode' },
  { cmd: '/model',    desc: 'Switch model' },
  // Session
  { cmd: '/session',  desc: 'Manage sessions' },
  { cmd: '/new',      desc: 'New session' },
  // Code
  { cmd: '/review',   desc: 'Review changes' },
  { cmd: '/commit',   desc: 'Generate commit message' },
  { cmd: '/diff',     desc: 'Show diff' },
  { cmd: '/search',   desc: 'Search codebase' },
  // Tools
  { cmd: '/mcp',      desc: 'Manage MCP servers' },
  { cmd: '/agents',   desc: 'Manage agents' },
  { cmd: '/tools',    desc: 'List available tools' },
  { cmd: '/hooks',    desc: 'Manage hooks' },
  { cmd: '/skills',   desc: 'Manage skills' },
  { cmd: '/plugins',  desc: 'Manage plugins' },
  // Info
  { cmd: '/config',   desc: 'Show configuration' },
  { cmd: '/status',   desc: 'Show system status' },
  { cmd: '/health',   desc: 'Health check' },
  { cmd: '/about',    desc: 'About MiniAgent' },
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
  modeLabel: string;
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
  inputBoxCol: number;
  inputBoxRow: number;
  inputBoxWidth: number;
}

type TUIMode = 'idle' | 'active';

interface SlashMenuState {
  visible: boolean;
  filter: string;
  selected: number;
  scrollOffset: number;
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
  private spinnerIdx = 0;
  private slashMenu: SlashMenuState = {
    visible: false,
    filter: '',
    selected: 0,
    scrollOffset: 0,
    col: 0,
    row: 0,
    width: 0,
    height: 0,
  };

  // 自定义输入状态
  private inputBuffer = '';
  private inputCursor = 0;
  private inputCol = 0;
  private inputRow = 0;
  private inputBoxCol = 0;
  private inputBoxRow = 0;
  private inputBoxWidth = 0;
  private modeLabelCol = 0;
  private modeLabelRow = 0;

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
      modeLabel: '\x1b[1;36m',
      slashMenuBg: '\x1b[48;5;235m',
      slashMenuHighlight: '\x1b[38;5;208m',
      ...config.colors,
    };

    this.layout = {
      rightPanelWidth: 45,
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

    // 窗口 resize
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

    // 唯一 key handler（带 try-catch 保护）
    term.on('key', (name: string) => {
      try {
        if (!this.running) return;

        // CTRL_C 退出
        if (name === 'CTRL_C') {
          if (!this.exitConfirmed) {
            this.exitConfirmed = true;
            this.showExitConfirm();
          } else {
            this.destroy();
          }
          return;
        }

        // Slash 菜单模式
        if (this.slashMenu.visible) {
          this.handleSlashMenuKey(name);
          return;
        }

        // TAB: 切换模式
        if (name === 'TAB') {
          this.toggleMode();
          return;
        }

        // ENTER: 提交输入
        if (name === 'ENTER') {
          this.submitInput();
          return;
        }

        // ESCAPE: 取消输入
        if (name === 'ESCAPE') {
          this.cancelInput();
          return;
        }

        // BACKSPACE: 删除
        if (name === 'BACKSPACE') {
          if (this.inputCursor > 0) {
            this.inputBuffer = this.inputBuffer.slice(0, this.inputCursor - 1) + this.inputBuffer.slice(this.inputCursor);
            this.inputCursor--;
            this.redrawInput();
          }
          return;
        }

        // DELETE: 删除光标后
        if (name === 'DELETE') {
          if (this.inputCursor < this.inputBuffer.length) {
            this.inputBuffer = this.inputBuffer.slice(0, this.inputCursor) + this.inputBuffer.slice(this.inputCursor + 1);
            this.redrawInput();
          }
          return;
        }

        // 方向键
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
            this.inputBuffer = this.inputHistory[0];
            this.inputCursor = this.inputBuffer.length;
            this.redrawInput();
          }
          return;
        }

        if (name === 'DOWN') {
          if (this.inputHistory.length > 0) {
            this.inputBuffer = this.inputHistory[0];
            this.inputCursor = this.inputBuffer.length;
            this.redrawInput();
          }
          return;
        }

        // CTRL_L: 刷新
        if (name === 'CTRL_L') {
          if (this.tuiMode === 'idle') {
            this.renderIdle();
          } else {
            this.renderActiveLayout(this.getPanelData());
          }
          return;
        }

        // 普通字符
        if (name.length === 1) {
          this.inputBuffer = this.inputBuffer.slice(0, this.inputCursor) + name + this.inputBuffer.slice(this.inputCursor);
          this.inputCursor++;

          // 检测 slash 命令
          if (this.inputBuffer === '/') {
            this.openSlashMenu();
            return;
          }

          this.redrawInput();
        }
      } catch (err) {
        process.stderr.write(`[TUI] key handler error: ${err instanceof Error ? err.message : String(err)}\n`);
      }
    });

    this.tuiMode = 'idle';
    this.renderIdle();
    this.startInput();
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

  // ====================  MODE LABEL  ====================

  private renderModeLabel(): void {
    const modeLabel = this.appMode === 'plan' ? 'Plan' : 'Build';
    term.moveTo(this.modeLabelCol, this.modeLabelRow);
    term(`${this.colors.modeLabel}${modeLabel}${this.reset()}`);
  }

  private toggleMode(): void {
    this.appMode = this.appMode === 'plan' ? 'build' : 'plan';
    const modeLabel = this.appMode === 'plan' ? 'Plan' : 'Build';
    // 先用空格清空，防止 Plan/Build 长度不同导致残留
    term.moveTo(this.modeLabelCol, this.modeLabelRow);
    term(`\x1b[48;5;236m     \x1b[0m`);
    term.moveTo(this.modeLabelCol, this.modeLabelRow);
    term(`${this.colors.modeLabel}${modeLabel}${this.reset()}`);
    // 光标回到输入框
    term.moveTo(this.inputCol + this.inputCursor, this.inputRow);
  }

  // ====================  INPUT  ====================

  private startInput(): void {
    this.inputBuffer = '';
    this.inputCursor = 0;

    const col = this.tuiMode === 'idle' ? this.inputBoxCol + 2 : 2;
    const row = this.tuiMode === 'idle' ? this.inputBoxRow : this.termHeight() - 2;
    this.inputCol = col;
    this.inputRow = row;

    term.moveTo(col, row);
  }

  private redrawInput(): void {
    term.moveTo(this.inputCol, this.inputRow);
    const display = this.inputBuffer || '';
    const remaining = this.termWidth() - this.inputCol + 1;
    const displayText = display.length > remaining ? display.substring(0, remaining - 1) : display;
    term(`${this.colors.accent}${displayText}${this.reset()}`);
    term(`\x1b[K`);
    this.moveCursor();
  }

  private moveCursor(): void {
    term.moveTo(this.inputCol + this.inputCursor, this.inputRow);
  }

  private cancelInput(): void {
    this.inputBuffer = '';
    this.inputCursor = 0;
    if (this.tuiMode === 'idle') {
      this.renderIdle();
    } else {
      this.renderActiveLayout(this.getPanelData());
    }
    this.startInput();
  }

  private submitInput(): void {
    const text = this.inputBuffer;
    this.inputBuffer = '';
    this.inputCursor = 0;

    if (!text.trim()) {
      if (this.tuiMode === 'idle') {
        this.renderIdle();
        this.startInput();
      } else {
        this.startInput();
      }
      return;
    }

    this.pushHistory(text);

    // Slash 命令
    if (text.trim().startsWith('/')) {
      const handled = this.handleSlashCommand(text.trim());
      if (handled) {
        if (this.tuiMode === 'idle') {
          this.renderIdle();
          this.startInput();
        } else {
          this.renderActiveLayout(this.getPanelData());
          this.startInput();
        }
        return;
      }
    }

    // 普通消息
    if (this.tuiMode === 'idle') {
      this.tuiMode = 'active';
      this.processMessage(text);
    } else {
      this.processMessage(text);
    }
  }

  // ====================  SLASH MENU  ====================

  private openSlashMenu(): void {
    const filtered = SLASH_COMMANDS;
    const menuWidth = this.inputBoxWidth;
    const menuHeight = Math.min(filtered.length, 12);
    const menuCol = this.inputBoxCol;
    // 菜单在输入框正上方
    const menuRow = this.inputBoxRow - menuHeight - 1;

    this.slashMenu = {
      visible: true,
      filter: '',
      selected: 0,
      scrollOffset: 0,
      col: menuCol,
      row: Math.max(1, menuRow),
      width: menuWidth,
      height: menuHeight,
    };

    this.renderSlashMenu();
  }

  private closeSlashMenu(): void {
    this.slashMenu.visible = false;
    this.slashMenu.filter = '';
    this.slashMenu.selected = 0;
    this.slashMenu.scrollOffset = 0;
  }

  private handleSlashMenuKey(name: string): void {
    if (name === 'ESCAPE') {
      this.closeSlashMenu();
      if (this.tuiMode === 'idle') {
        this.renderIdle();
      } else {
        this.renderActiveLayout(this.getPanelData());
      }
      this.startInput();
      return;
    }

    if (name === 'ENTER') {
      const filtered = this.getFilteredCommands();
      if (filtered.length > 0 && this.slashMenu.selected < filtered.length) {
        const cmd = filtered[this.slashMenu.selected].cmd;
        this.closeSlashMenu();
        this.inputBuffer = cmd;
        this.inputCursor = cmd.length;
        if (this.tuiMode === 'idle') {
          this.renderIdle();
        } else {
          this.renderActiveLayout(this.getPanelData());
        }
        this.redrawInput();
      } else {
        this.closeSlashMenu();
        this.startInput();
      }
      return;
    }

    if (name === 'UP') {
      if (this.slashMenu.selected > 0) {
        this.slashMenu.selected--;
        // 滚动：选中项移到可视区域顶部之上时，scrollOffset 跟着上移
        if (this.slashMenu.selected < this.slashMenu.scrollOffset) {
          this.slashMenu.scrollOffset = this.slashMenu.selected;
        }
        this.renderSlashMenu();
      }
      return;
    }

    if (name === 'DOWN') {
      const filtered = this.getFilteredCommands();
      if (this.slashMenu.selected < filtered.length - 1) {
        this.slashMenu.selected++;
        // 滚动：选中项移出可视区域底部时，scrollOffset 跟着下移
        const visibleEnd = this.slashMenu.scrollOffset + this.slashMenu.height;
        if (this.slashMenu.selected >= visibleEnd) {
          this.slashMenu.scrollOffset = this.slashMenu.selected - this.slashMenu.height + 1;
        }
        this.renderSlashMenu();
      }
      return;
    }

    if (name === 'TAB') {
      const filtered = this.getFilteredCommands();
      if (filtered.length > 0) {
        this.slashMenu.selected = (this.slashMenu.selected + 1) % filtered.length;
        // TAB 循环也需要同步滚动
        const visibleEnd = this.slashMenu.scrollOffset + this.slashMenu.height;
        if (this.slashMenu.selected >= visibleEnd) {
          this.slashMenu.scrollOffset = this.slashMenu.selected - this.slashMenu.height + 1;
        }
        if (this.slashMenu.selected < this.slashMenu.scrollOffset) {
          this.slashMenu.scrollOffset = this.slashMenu.selected;
        }
        this.renderSlashMenu();
      }
      return;
    }

    // 字符输入: 过滤
    if (name.length === 1 && /[a-zA-Z]/.test(name)) {
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
    const visible = filtered.slice(this.slashMenu.scrollOffset, this.slashMenu.scrollOffset + height);

    // 暗色背景（无边框，类似 OpenCode）
    const bgFill = ' '.repeat(width);
    for (let r = 0; r < visible.length; r++) {
      term.moveTo(col, row + r);
      term(`\x1b[48;5;236m${bgFill}\x1b[0m`);
    }

    // 命令列表
    visible.forEach((cmd, i) => {
      const globalIdx = this.slashMenu.scrollOffset + i;
      const isSel = globalIdx === this.slashMenu.selected;
      const cmdStr = cmd.cmd;
      const descStr = cmd.desc;
      const maxCmdLen = 15;
      const paddedCmd = cmdStr.padEnd(maxCmdLen);
      const maxDescLen = width - maxCmdLen - 2;
      const displayDesc = descStr.length > maxDescLen ? descStr.substring(0, maxDescLen - 1) + '…' : descStr;

      term.moveTo(col + 1, row + i);
      if (isSel) {
        // 整行品牌蓝色背景
        term(`\x1b[48;5;24m\x1b[38;5;255m ${paddedCmd} ${displayDesc}${' '.repeat(Math.max(0, width - paddedCmd.length - displayDesc.length - 3))}\x1b[0m`);
      } else {
        // 未选中：白色文字（OpenCode 风格）
        term(`\x1b[48;5;236m\x1b[38;5;255m ${paddedCmd} \x1b[38;5;248m${displayDesc}${' '.repeat(Math.max(0, width - paddedCmd.length - displayDesc.length - 3))}\x1b[0m`);
      }
    });
  }

  // ====================  SLASH COMMANDS  ====================

  private handleSlashCommand(cmd: string): boolean {
    const trimmed = cmd.toLowerCase();
    if (trimmed === '/build') {
      this.appMode = 'build';
      process.stderr.write(`[TUI] Switched to build mode\n`);
      return true;
    }
    if (trimmed === '/quit' || trimmed === '/exit') {
      this.destroy();
      return true;
    }
    if (trimmed === '/plan') {
      this.appMode = this.appMode === 'plan' ? 'build' : 'plan';
      process.stderr.write(`[TUI] Switched to ${this.appMode} mode\n`);
      return true;
    }
    if (trimmed === '/new') {
      this.messages = [];
      this.cumulativeUsage = { input: 0, output: 0, total: 0 };
      process.stderr.write('[TUI] /new: New session started\n');
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
    if (trimmed === '/status') {
      process.stderr.write(`[TUI] /status: Model=${this.model}, Mode=${this.appMode}, Messages=${this.messages.length}, Tokens=${this.cumulativeUsage.total}\n`);
      return true;
    }
    if (trimmed === '/tools') {
      process.stderr.write('[TUI] /tools: Bash, FileRead, FileWrite, FileEdit, Glob, Grep, WebFetch, WebSearch, TodoWrite, Config, Github, Task, AskUser, SubAgent, PlanMode, MCP, Memory, Format, MultiEdit, LSP, Question, ApplyPatch, ReadImage, Share, Notebook, Worktree\n');
      return true;
    }
    if (trimmed === '/about') {
      process.stderr.write('[TUI] MiniAgent v' + VERSION + ' - A local AI Agent framework\n');
      return true;
    }
    // /diff, /search, /mcp, /agents, /hooks, /skills, /plugins, /health
    const mapCommands: Record<string, string> = {
      '/diff': 'diff viewer',
      '/search': 'codebase search',
      '/mcp': 'MCP server manager',
      '/agents': 'agent manager',
      '/hooks': 'hook manager',
      '/skills': 'skill manager',
      '/plugins': 'plugin manager',
      '/health': 'health check',
    };
    if (mapCommands[trimmed]) {
      process.stderr.write(`[TUI] ${trimmed}: ${mapCommands[trimmed]} (not yet implemented)\n`);
      return true;
    }
    return false;
  }

  // ====================  IDLE MODE  ====================

  private renderIdle(): void {
    const w = this.termWidth();
    const h = this.termHeight();

    this.clearScreen();

    const logoH = LOGO.length;
    const logoW = w >= 90 ? 84 : Math.min(84, w - 2);

    const contentH = logoH + 1 + 2 + 4 + 2;
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

    // Input box (4 rows)
    this.inputBoxWidth = Math.min(76, w - 4);
    this.inputBoxCol = Math.max(1, Math.floor((w - this.inputBoxWidth) / 2));
    this.inputBoxRow = subRow + 2;

    const boxFill = ' '.repeat(this.inputBoxWidth);
    for (let r = 0; r < 4; r++) {
      term.moveTo(this.inputBoxCol, this.inputBoxRow + r);
      term(`\x1b[48;5;236m${boxFill}\x1b[0m`);
    }

    // Left accent
    for (let r = 0; r < 4; r++) {
      term.moveTo(this.inputBoxCol, this.inputBoxRow + r);
      term(`\x1b[48;5;24m \x1b[0m`);
    }

    // Row 1: placeholder
    const placeholder = 'Ask anything...  "What is the tech stack of this project?"';
    term.moveTo(this.inputBoxCol + 2, this.inputBoxRow);
    term(`\x1b[38;5;102;48;5;236m${placeholder}\x1b[0m`);

    // Row 3: mode + model
    this.modeLabelCol = this.inputBoxCol + 2;
    this.modeLabelRow = this.inputBoxRow + 2;
    this.renderModeLabel();

    const modelCol = this.modeLabelCol + 6;
    term.moveTo(modelCol, this.modeLabelRow);
    term(`${this.colors.dim}· ${this.model}${this.reset()}`);

    // Row 4: bottom border
    const borderCh = '─';
    term.moveTo(this.inputBoxCol + 2, this.inputBoxRow + 3);
    term(`\x1b[48;5;236m${this.colors.border}${borderCh.repeat(this.inputBoxWidth - 3)}${this.reset()}`);

    // Tips below box
    const tipsText = 'tab: switch mode  /: commands  ctrl+p: commands';
    const tipsRow = this.inputBoxRow + 4;
    const tipsCol = Math.max(1, Math.floor((w - tipsText.length) / 2));
    term.moveTo(tipsCol, tipsRow);
    term(`${this.colors.dim}${tipsText}${this.reset()}`);

    // Bottom bar
    this.renderBottomBar();
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

  // ====================  ACTIVE MODE  ====================

  private async processMessage(text: string): Promise<void> {
    this.messages.push({ role: 'user', content: text, timestamp: Date.now() });

    const panelData = this.getPanelData();
    this.renderActiveLayout(panelData);

    // 设置输入框光标位置（底部输入框）
    const h = this.termHeight();
    const w = this.termWidth();
    this.inputRow = h - 3;  // 输入框在第 h-3 行（4行高度：h-3, h-2, h-1, h）
    this.inputCol = 3;      // 输入光标在提示符后

    this.startSpinner();

    const startTime = Date.now();
    let response = '';
    const toolCalls: string[] = [];
    try {
      for await (const chunk of this.agent.chat(text)) {
        if (!this.running) break;

        if (chunk.type === 'content' && chunk.content) {
          // 过滤掉 JSON 格式的内容（tool_call 泄露）
          const filtered = this.filterJsonContent(chunk.content);
          if (filtered) {
            response += filtered;
            this.streamContentToActiveArea(response, panelData);
          }
        }

        if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCalls.push(chunk.toolCall.name);
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
      const elapsed = Date.now() - startTime;
      this.messages.push({ role: 'thought', content: `Thought: ${elapsed}ms`, timestamp: Date.now() });
      if (toolCalls.length > 0) {
        const toolSummary = `${toolCalls.join(', ')}`;
        this.messages.push({ role: 'tool', content: toolSummary, timestamp: Date.now() });
      }
      this.messages.push({ role: 'assistant', content: response, timestamp: Date.now() });
    }

    this.renderActiveLayout(this.getPanelData());
    this.startInput();
  }

  // 过滤掉 JSON 格式的内容（防止 tool_call 泄露）
  private filterJsonContent(content: string): string {
    // 如果是纯 JSON 对象，过滤掉
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.name && parsed.arguments) {
          // 这是 tool_call JSON，过滤掉
          return '';
        }
      } catch {
        // 不是有效 JSON，保留
      }
    }
    // 过滤掉 markdown JSON 代码块
    if (trimmed.startsWith('```json') || trimmed.startsWith('```JSON')) {
      return '';
    }
    return content;
  }

  private startSpinner(): void {
    this.spinnerIdx = 0;
    const h = this.termHeight();
    // 设置输入框光标位置（底部）
    if (!this.inputRow) {
      this.inputRow = h - 1;
      this.inputCol = 2;
    }

    this.spinnerInterval = setInterval(() => {
      if (!this.running) return;
      // 脉冲效果：- \ | / 来回扫描
      const pulseChars = '-\\|/';
      const ch = pulseChars[this.spinnerIdx % pulseChars.length];
      this.spinnerIdx++;

      // 在 Build 后面显示脉冲效果
      const modeLabel = this.appMode === 'plan' ? 'Plan' : 'Build';
      const statusRow = this.termHeight();
      
      // 左侧 Build 区域 + 脉冲效果
      term.moveTo(2, statusRow);
      term(`${this.colors.modeLabel}${modeLabel}${this.reset()} ${this.colors.dim}· ${this.model} ${this.colors.thought}· ${ch}${this.reset()}`);

      // 右侧状态栏
      const inputPct = this.cumulativeUsage.total > 0
        ? Math.round((this.cumulativeUsage.output / Math.max(1, this.cumulativeUsage.total)) * 100)
        : 0;
      const usageText = `${(this.cumulativeUsage.total / 1000).toFixed(1)}K (${inputPct}%)`;
      const ver = `OpenCode ${VERSION}`;
      const rightInfo = `${usageText}  ctrl+p commands    ${ver}`;
      term.moveTo(this.termWidth() - rightInfo.length, statusRow);
      term(`${this.colors.dim}${usageText}${this.reset()}  ${this.colors.shortcut}ctrl+p commands${this.reset()}    ${this.colors.dim}${ver}${this.reset()}`);

      // 光标始终保持在底部输入框位置（不阻塞输入）
      term.moveTo(this.inputCol, this.inputRow);
    }, 200);
  }

  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
    // 恢复正常的状态栏
    const statusRow = this.termHeight();
    const modeLabel = this.appMode === 'plan' ? 'Plan' : 'Build';
    term.moveTo(2, statusRow);
    term(`${this.colors.modeLabel}${modeLabel}${this.reset()} ${this.colors.dim}· ${this.model}${this.reset()}`);
    
    // 右侧状态栏
    const inputPct = this.cumulativeUsage.total > 0
      ? Math.round((this.cumulativeUsage.output / Math.max(1, this.cumulativeUsage.total)) * 100)
      : 0;
    const usageText = `${(this.cumulativeUsage.total / 1000).toFixed(1)}K (${inputPct}%)`;
    const ver = `OpenCode ${VERSION}`;
    const rightInfo = `${usageText}  ctrl+p commands    ${ver}`;
    term.moveTo(this.termWidth() - rightInfo.length, statusRow);
    term(`${this.colors.dim}${usageText}${this.reset()}  ${this.colors.shortcut}ctrl+p commands${this.reset()}    ${this.colors.dim}${ver}${this.reset()}`);
  }

  private renderActiveLayout(panelData: RightPanelData): void {
    const w = this.termWidth();
    const h = this.termHeight();
    const leftW = this.leftWidth();
    const inputBoxRows = 6;  // 上边距1 + 输入框4 + 下边距1
    const contentHeight = h - inputBoxRows;

    this.clearScreen();

    // Vertical divider - only up to content area
    for (let row = 1; row <= contentHeight; row++) {
      term.moveTo(leftW + 1, row);
      term(`\x1b[2m│${this.reset()}`);
    }

    // Render right panel (only up to content area, title at top)
    this.renderRightPanel(panelData, contentHeight, w);

    // Render messages area
    this.renderMessageArea(1, 2, leftW, contentHeight - 2);

    // Input box (only on left side)
    this.renderInputBox(leftW, h, panelData);

    // Ensure cursor is in input box
    term.moveTo(this.inputCol, this.inputRow);
  }

  private renderRightPanel(data: RightPanelData, height: number, w: number): void {
    const leftW = this.leftWidth();
    const panelW = w - leftW - 1;
    const panelCol = leftW + 2;

    // 右侧面板背景色 #141414
    const panelBg = '\x1b[48;2;20;20;20m';
    const panelFill = ' '.repeat(panelW);
    
    for (let r = 1; r <= height; r++) {
      term.moveTo(panelCol, r);
      term(`${panelBg}${panelFill}\x1b[0m`);
    }

    let row = 1;
    const contentCol = panelCol + 1;

    // 对话标题在右侧边栏顶部
    const title = data.taskTitle || 'New Chat';
    term.moveTo(contentCol, row);
    term(`${this.colors.accent}${title}${this.reset()}`);
    row += 2;

    // Context section
    const inputPct = this.cumulativeUsage.total > 0
      ? Math.round((this.cumulativeUsage.output / Math.max(1, this.cumulativeUsage.total)) * 100)
      : 0;
    
    term.moveTo(contentCol, row);
    term(`${this.colors.panelTitle}Context${this.reset()}`);
    row++;
    
    term.moveTo(contentCol, row);
    term(`${this.colors.dim}${this.cumulativeUsage.total.toLocaleString()} tokens${this.reset()}`);
    row++;
    
    term.moveTo(contentCol, row);
    term(`${this.colors.dim}${inputPct}% used${this.reset()}`);
    row++;
    
    term.moveTo(contentCol, row);
    term(`${this.colors.dim}$0.00 spent${this.reset()}`);
    row += 2;

    // LSP section
    term.moveTo(contentCol, row);
    term(`${this.colors.panelTitle}LSP${this.reset()}`);
    row++;
    term.moveTo(contentCol, row);
    term(`${this.colors.dim}LSPs are disabled${this.reset()}`);
    row += 2;

    // Bottom info: path and version
    const cwd = process.cwd();
    const cwdShort = cwd.split('\\').pop() || '';

    term.moveTo(contentCol, height - 1);
    term(`${this.colors.dim}/${cwdShort}:main${this.reset()}`);

    const ver = `OpenCode ${VERSION}`;
    term.moveTo(contentCol, height);
    term(`${this.colors.dim}${ver}${this.reset()}`);
  }

  private renderInputBox(leftW: number, height: number, _panelData: RightPanelData): void {
    const inputBoxRows = 6;
    const boxTop = height - inputBoxRows + 1;  // 上边距1行 + 输入框4行
    const inputRow = boxTop + 1;  // 跳过1行上边距

    // Store input position for cursor during spinner
    this.inputRow = inputRow;
    this.inputCol = 3;

    // Input box: 4 rows, only on left side
    const bgFill = ' '.repeat(leftW);
    for (let r = 0; r < 4; r++) {
      term.moveTo(1, inputRow + r);
      term(`\x1b[48;5;236m${bgFill}\x1b[0m`);
      // Left blue accent
      term.moveTo(1, inputRow + r);
      term(`\x1b[48;5;24m \x1b[0m`);
    }

    // Row 1: Prompt
    term.moveTo(2, inputRow);
    term(`${this.colors.dim}> ${this.reset()}`);

    // Shortcuts on right side (input row)
    const shortcuts = `tab`;
    term.moveTo(leftW - shortcuts.length, inputRow);
    term(`${this.colors.shortcut}${shortcuts}${this.reset()}`);

    // Row 2: empty (for cursor/input)
    // Row 3: Model on left
    const modeLabel = this.appMode === 'plan' ? 'Plan' : 'Build';
    this.modeLabelCol = 2;
    this.modeLabelRow = inputRow + 2;
    term.moveTo(2, inputRow + 2);
    term(`${this.colors.modeLabel}${modeLabel}${this.reset()} ${this.colors.dim}· ${this.model}${this.reset()}`);

    // Row 3: Right side info
    const inputPct = this.cumulativeUsage.total > 0
      ? Math.round((this.cumulativeUsage.output / Math.max(1, this.cumulativeUsage.total)) * 100)
      : 0;
    const usageText = `${(this.cumulativeUsage.total / 1000).toFixed(1)}K (${inputPct}%)`;
    const ver = `OpenCode ${VERSION}`;
    
    const rightInfo = `${usageText}  ctrl+p commands    ${ver}`;
    term.moveTo(leftW - rightInfo.length, inputRow + 2);
    term(`${this.colors.dim}${usageText}${this.reset()}  ${this.colors.shortcut}ctrl+p commands${this.reset()}    ${this.colors.dim}${ver}${this.reset()}`);
  }

  private renderPanelSection(col: number, startRow: number, title: string, lines: string[]): number {
    term.moveTo(col, startRow);
    term(`${this.colors.panelTitle}${title}${this.reset()}`);

    lines.forEach((line, i) => {
      term.moveTo(col, startRow + 1 + i);
      term(`${this.colors.dim}${line}${this.reset()}`);
    });

    return startRow + 1 + lines.length + 1;
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
        term.moveTo(col + 1, row);
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
        // OpenCode 风格：用户消息深色背景条，左对齐
        return ` ${this.colors.accent}${msg.content}${R}`;
      case 'assistant':
        return `${this.processAssistantContent(msg.content, width)}${R}`;
      case 'thought':
        return `${this.colors.thought}+ ${msg.content}${R}`;
      case 'tool':
        return `${this.colors.dim}% ${msg.content}${R}`;
      default:
        return msg.content;
    }
  }

  private processAssistantContent(content: string, width: number): string {
    return content.split('\n').map(line => {
      if (line.startsWith('+ Thought:')) {
        return `${this.colors.thought}${line}${this.reset()}`;
      }
      if (line.startsWith('% ')) {
        return `${this.colors.dim}${line}${this.reset()}`;
      }
      return line;
    }).join('\n');
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
    // 标题：不使用用户消息，保持固定标题（避免和消息区域重复）
    return {
      taskTitle: 'New Chat',
      contextUsage: this.cumulativeUsage,
      todos: getTodos(),
      model: this.model,
      appMode: this.appMode,
      inputBoxCol: this.inputBoxCol,
      inputBoxRow: this.inputBoxRow,
      inputBoxWidth: this.inputBoxWidth,
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

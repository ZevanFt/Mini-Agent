import readline from 'readline';
import type { Agent } from '../core/agent.js';
import { createSlashCommands, type SlashCommand } from '../core/commands.js';

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  grey: '\x1b[38;5;245m',
  white: '\x1b[38;5;252m',
  blue: '\x1b[38;5;39m',
  orange: '\x1b[38;5;208m',
  cyan: '\x1b[38;5;45m',
  bgInput: '\x1b[48;5;234m',
  bgWhite: '\x1b[48;5;252m',
  fgBlack: '\x1b[38;5;16m',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  clearScreen: '\x1b[2J\x1b[H',
};

function moveTo(row: number, col: number): string {
  return `\x1b[${Math.max(1, row)};${Math.max(1, col)}H`;
}

function centerText(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function write(s: string): void {
  process.stdout.write(s);
}

async function loadLogoFromMd(): Promise<string[]> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const logoPath = path.join(process.cwd(), 'assets', 'logo.md');
    const content = await fs.promises.readFile(logoPath, 'utf-8');
    const codeBlockMatch = content.match(/```\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim().split('\n').filter(l => l.trim());
    }
    return content.split('\n').filter(l => l.trim());
  } catch {
    return [];
  }
}

const AGENT_MODES = ['Build', 'Plan'] as const;
type AgentMode = typeof AGENT_MODES[number];

export function destroyTUI(): void {
  write(C.showCursor);
  write(C.reset);
  write(C.clearScreen);
}

interface TUIOptions {
  agent: Agent;
  model: string;
  sessionId: string;
  cwd: string;
  version: string;
}

export async function initTUI({ agent, model, sessionId, cwd, version }: TUIOptions) {
  const slashCommands = createSlashCommands();

  const loadedLogo = await loadLogoFromMd();
  const LOGO = loadedLogo.length > 0 ? loadedLogo : [
    '  ___  _   _  _____  ___  ____  ____   _____  ____  ____ ',
    ' / _ \\| | | ||  ___|/ _ \\|  _ \\| __ ) | ____|/ ___||  _ \\',
    '| | | | | | || |_  | | | | |_) |  _ \\ |  _| | |    | |_) |',
    '| |_| | |_| ||  _| | |_| |  __/| |_) || |___| |___ |  _ < ',
    ' \\__\\_\\\\__,_||_|    \\___/|_|   |____/ |_____\\____||_| \\_\\',
  ];

  let modeIndex = 0;
  let agentName = 'coder';
  const inputHistory: string[] = [];
  let historyIndex = -1;
  let isProcessing = false;
  let showSlashMenu = false;
  let slashFilter = '';
  let inputText = '';
  let cursorPos = 0;
  let systemMessage = '';
  let systemMessageTimer: ReturnType<typeof setTimeout> | null = null;
  let cursorVisible = true;
  let cursorTimer: ReturnType<typeof setInterval> | null = null;

  function getSize(): { width: number; height: number } {
    return {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24,
    };
  }

  function showSystemMsg(msg: string, duration = 4000) {
    systemMessage = msg;
    if (systemMessageTimer) clearTimeout(systemMessageTimer);
    systemMessageTimer = setTimeout(() => {
      systemMessage = '';
      render();
    }, duration);
  }

  function toggleCursor(): void {
    cursorVisible = !cursorVisible;
    render();
  }

  function render() {
    const { width, height } = getSize();

    const logoH = LOGO.length;
    const boxH = 4;
    const totalH = logoH + 2 + boxH + 1 + 2;
    const offset = Math.max(0, Math.floor((height - totalH) / 2));

    const logoRow = offset + 1;
    const boxRow = logoRow + logoH + 2;
    const tipRow = boxRow + boxH + 1;
    const statusRow = height;

    const boxW = Math.min(68, width - 6);
    const boxCol = Math.max(1, Math.floor((width - boxW) / 2));

    const currentMode = AGENT_MODES[modeIndex];
    const modelName = model.split(':')[0];

    let out = '';

    out += C.clearScreen;

    for (let i = 0; i < LOGO.length; i++) {
      out += moveTo(logoRow + i, 1);
      out += centerText(LOGO[i], width);
    }

    out += moveTo(boxRow, boxCol);
    out += C.bgInput + ' '.repeat(boxW) + C.reset;
    out += moveTo(boxRow, boxCol + 1);
    out += C.dim + '> ' + C.dim;
    if (inputText) {
      out += C.white + inputText;
    } else {
      out += 'Ask anything...  ' + C.grey + '"Fix broken tests"';
    }

    const cursorCol = inputText
      ? boxCol + 3 + Math.min(cursorPos, inputText.length)
      : boxCol + 3;
    if (cursorVisible && cursorCol < boxCol + boxW) {
      out += moveTo(boxRow, cursorCol);
      out += C.bgWhite + C.fgBlack + ' ' + C.reset;
    }

    out += moveTo(boxRow + 1, boxCol);
    out += C.bgInput + ' '.repeat(boxW) + C.reset;
    out += moveTo(boxRow + 1, boxCol + 1);
    out += C.blue + currentMode + C.dim + ' · ' + C.grey + modelName + ' ' + agentName;

    out += moveTo(boxRow + 2, boxCol);
    out += C.bgInput + ' '.repeat(boxW) + C.reset;
    out += moveTo(boxRow + 2, boxCol);
    out += C.dim + '─'.repeat(boxW) + C.reset;

    out += moveTo(boxRow + 3, boxCol);
    out += C.bgInput + ' '.repeat(boxW) + C.reset;
    const hintText = 'tab agents  ctrl+p commands';
    const hintCol = Math.max(boxCol + 1, boxCol + boxW - hintText.length - 1);
    out += moveTo(boxRow + 3, hintCol);
    out += C.dim + hintText + C.reset;

    if (systemMessage) {
      const tip = '● ' + systemMessage;
      out += moveTo(tipRow, Math.max(1, Math.floor((width - tip.length) / 2)));
      out += C.orange + '● ' + C.dim + systemMessage + C.reset;
    } else {
      const defaultTip = '● Use /help for commands, or just start chatting';
      out += moveTo(tipRow, Math.max(1, Math.floor((width - defaultTip.length) / 2)));
      out += C.orange + '● ' + C.dim + 'Use /help for commands, or just start chatting' + C.reset;
    }

    if (showSlashMenu) {
      const commands = getFilteredCommands();
      const menuMaxH = Math.min(commands.length, Math.max(4, Math.floor(height / 4)));
      const menuRow = Math.max(boxRow - menuMaxH, logoRow + logoH + 1);

      out += moveTo(menuRow - 1, boxCol);
      out += C.bgWhite + C.fgBlack + ' /' + slashFilter + ' ' + C.reset;
      out += C.bgInput + ' '.repeat(Math.max(0, boxW - slashFilter.length - 3)) + C.reset;

      for (let i = 0; i < menuMaxH; i++) {
        const cmd = commands[i];
        if (!cmd) break;
        out += moveTo(menuRow + i, boxCol);
        out += C.bgInput + ' '.repeat(boxW) + C.reset;
        out += moveTo(menuRow + i, boxCol + 1);
        out += C.cyan + '/' + cmd.name;
        out += C.dim + '  ' + (cmd.description || '');
      }
    }

    out += moveTo(statusRow, 1);
    out += C.dim + cwd + ':main' + C.reset;

    const vText = version;
    out += moveTo(statusRow, width - vText.length);
    out += C.dim + vText + C.reset;

    out += C.hideCursor;

    write(out);
  }

  function getFilteredCommands(): SlashCommand[] {
    return slashCommands.filter(cmd =>
      cmd.name.includes(slashFilter) || cmd.description?.includes(slashFilter)
    );
  }

  function findSlashCommand(name: string): SlashCommand | undefined {
    return slashCommands.find(cmd => cmd.name === name);
  }

  function executeSlashCommand(cmd: SlashCommand, args: string) {
    if (!cmd.execute) return;
    const result = cmd.execute({ agent, args });
    if (result) {
      const text = typeof result === 'string' ? result : JSON.stringify(result);
      showSystemMsg(text.substring(0, 50));
    }
  }

  async function processInput() {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    isProcessing = true;
    inputHistory.unshift(text);
    historyIndex = -1;

    if (text.startsWith('/')) {
      const spaceIdx = text.indexOf(' ');
      const cmdName = text.substring(1, spaceIdx > 0 ? spaceIdx : text.length);
      const args = spaceIdx > 0 ? text.substring(spaceIdx + 1) : '';
      const cmd = findSlashCommand(cmdName);
      if (cmd) executeSlashCommand(cmd, args);
      inputText = '';
      cursorPos = 0;
      isProcessing = false;
      showSlashMenu = false;
      render();
      return;
    }

    inputText = '';
    cursorPos = 0;
    render();

    try {
      showSystemMsg('Agent is thinking...');
      const stream = agent.chat(text);
      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
      }
      if (fullResponse) {
        const preview = fullResponse.substring(0, 50);
        showSystemMsg(preview + (fullResponse.length > 50 ? '...' : ''));
      }
    } catch (err) {
      showSystemMsg('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      isProcessing = false;
      render();
    }
  }

  let rl: readline.Interface;

  function start() {
    // 关键修改：不使用 raw mode，让 readline 正常处理中文 IME
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // 启用 keypress 事件但不设置 raw mode
    readline.emitKeypressEvents(process.stdin, rl);

    // Blinking cursor
    cursorTimer = setInterval(toggleCursor, 530);

    process.stdin.on('keypress', (_str: string, key: readline.Key) => handleKey(key));

    // 处理行输入（支持中文）
    rl.on('line', (line: string) => {
      // 只有当行内容不为空且不是纯控制字符时才处理
      if (line && line.length > 0) {
        // 将行内容追加到输入文本
        inputText = inputText.slice(0, cursorPos) + line + inputText.slice(cursorPos);
        cursorPos += line.length;
        render();
      }
    });

    render();
  }

  async function handleKey(key: readline.Key) {
    const { ctrl, name, sequence } = key;

    if (ctrl && (name === 'c' || name === 'd')) {
      if (cursorTimer) clearInterval(cursorTimer);
      destroyTUI();
      process.exit(0);
      return;
    }

    // Tab: switch agent mode
    if (name === 'tab' && !showSlashMenu) {
      modeIndex = (modeIndex + 1) % AGENT_MODES.length;
      render();
      return;
    }

    if (ctrl && name === 'p') {
      showSlashMenu = !showSlashMenu;
      if (showSlashMenu) {
        slashFilter = '';
      } else {
        inputText = '';
        cursorPos = 0;
      }
      render();
      return;
    }

    if (showSlashMenu) {
      if (name === 'return') {
        const cmds = getFilteredCommands();
        if (cmds.length === 1) {
          inputText = '/' + cmds[0].name;
          slashFilter = cmds[0].name;
          cursorPos = inputText.length;
          render();
        } else if (cmds.length > 1) {
          await processInput();
          showSlashMenu = false;
        }
        return;
      }
      if (name === 'escape') {
        showSlashMenu = false;
        render();
        return;
      }
      if (name === 'backspace') {
        if (slashFilter.length > 0) {
          slashFilter = slashFilter.slice(0, -1);
        } else {
          showSlashMenu = false;
        }
        render();
        return;
      }
      if (name && name.length === 1 && name >= ' ') {
        slashFilter += name;
        render();
        return;
      }
      return;
    }

    if (name === 'return') {
      await processInput();
      return;
    }
    if (name === 'backspace') {
      if (cursorPos > 0) {
        inputText = inputText.slice(0, cursorPos - 1) + inputText.slice(cursorPos);
        cursorPos--;
        render();
      }
      return;
    }
    if (name === 'up') {
      if (inputHistory.length > 0 && historyIndex < inputHistory.length - 1) {
        historyIndex++;
        inputText = inputHistory[historyIndex];
        cursorPos = inputText.length;
        render();
      }
      return;
    }
    if (name === 'down') {
      if (historyIndex > 0) {
        historyIndex--;
        inputText = inputHistory[historyIndex];
        cursorPos = inputText.length;
        render();
      } else if (historyIndex === 0) {
        historyIndex = -1;
        inputText = '';
        cursorPos = 0;
        render();
      }
      return;
    }
    if (name === 'left' && cursorPos > 0) {
      cursorPos--;
      render();
      return;
    }
    if (name === 'right' && cursorPos < inputText.length) {
      cursorPos++;
      render();
      return;
    }
    if (name === 'home') {
      cursorPos = 0;
      render();
      return;
    }
    if (name === 'end') {
      cursorPos = inputText.length;
      render();
      return;
    }
    // 普通字符输入
    if (name && name.length === 1 && name >= ' ') {
      inputText = inputText.slice(0, cursorPos) + name + inputText.slice(cursorPos);
      cursorPos++;
      render();
    }
  }

  function waitForExit(): Promise<void> {
    return new Promise(resolve => {
      rl?.on('close', () => {
        if (cursorTimer) clearInterval(cursorTimer);
        destroyTUI();
        resolve();
      });
      process.on('SIGINT', () => {
        if (cursorTimer) clearInterval(cursorTimer);
        destroyTUI();
        resolve();
      });
    });
  }

  return { start, waitForExit };
}

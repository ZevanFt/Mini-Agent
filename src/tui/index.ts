import React from 'react';
import { render } from 'ink';
import type { Agent } from '../core/agent.js';
import { MiniAgentTUI } from './MiniAgentTUI.js';
import { Starfield } from './primitives/Starfield.js';
import { ScreenBuffer } from './primitives/ScreenBuffer.js';
import { ModalCompositor } from './primitives/ModalCompositor.js';
import { modalState } from './primitives/ModalState.js';

// Patch cli-cursor: prevent Ink from hiding the terminal cursor.
// We control cursor visibility ourselves via ANSI escape sequences.
import cliCursor from 'cli-cursor';
cliCursor.hide = () => {};

interface TUIOptions {
  agent: Agent;
  model: string;
  sessionId: string;
  cwd: string;
  version: string;
}

export function destroyTUI(): void {
  // Ink handles cleanup automatically
}

export async function initTUI({ agent, model, cwd, version }: TUIOptions) {
  let cleanupFn: (() => void) | null = null;

  function start() {
    // Enter alternate screen buffer
    process.stdout.write('\x1b[?1049h');

    // Save reference to original write BEFORE wrapping
    const originalWrite = process.stdout.write.bind(process.stdout);

    // Starfield background
    const termRows = process.stdout.rows || 30;
    const termCols = process.stdout.columns || 120;
    const starfield = new Starfield(termRows, termCols, 0.004);
    let showStarfield = true;
    let twinkleTimer: ReturnType<typeof setInterval> | null = null;

    // === 半透明 Modal 合成器 ===
    // screenBuffer：累积解析 Ink 输出的 ANSI 流，维护二维字符网格
    // preservedBg：独立保存的背景快照（不含 modal），modal 关闭时更新，modal 打开时用于合成
    // compositor：基于 preservedBg 做 modal 区域 + 背景降亮度的合成
    const screenBuffer = new ScreenBuffer(termRows, termCols);
    const preservedBg = new ScreenBuffer(termRows, termCols);
    const compositor = new ModalCompositor(preservedBg);
    let backgroundCaptured = false; // 标记是否已捕获初始背景

    // Twinkle stars every 500ms
    twinkleTimer = setInterval(() => {
      if (showStarfield) starfield.twinkle();
    }, 500);

    // Cursor positioning: after EVERY Ink write to stdout, we append our cursor
    // command. This ensures the cursor stays at the right position even after
    // Ink's throttled re-renders.
    let pendingCursorCmd = '';

    (process.stdout as any).write = function (data: string | Uint8Array, ...args: any[]): boolean {
      const str = typeof data === 'string'
        ? data
        : Buffer.from(data).toString('utf8');

      // 检测是否是清屏命令（Ink re-render 时会先清屏）
      const isClearScreen = str.includes('\x1b[2J') || str.includes('\x1b[H\x1b[2J');

      // 检查 modal 状态
      const modal = modalState.get();
      const isModalOpen = modal && modal.isOpen;

      if (isClearScreen) {
        if (!isModalOpen) {
          // modal 关闭时清屏 → 快照背景到 preservedBg
          let hasContent = false;
          outer: for (let r = 0; r < termRows; r++) {
            for (let c = 0; c < termCols; c++) {
              const cell = screenBuffer.get(r, c);
              if (cell && (cell.char !== ' ' || cell.bg !== null)) {
                hasContent = true;
                break outer;
              }
            }
          }
          if (hasContent) {
            preservedBg.clear();
            for (let r = 0; r < termRows; r++) {
              for (let c = 0; c < termCols; c++) {
                const cell = screenBuffer.get(r, c);
                if (cell) preservedBg.set(r, c, cell);
              }
            }
            if (showStarfield) {
              starfield.renderToBuffer(preservedBg);
            }
            backgroundCaptured = true;
          }
          screenBuffer.clear();
        } else {
          // modal 打开时清屏 → 清空 screenBuffer
          screenBuffer.clear();
        }
      } else {
        screenBuffer.write(str);
        // 第一次非清屏写入时，捕获背景
        if (!backgroundCaptured && !isModalOpen) {
          preservedBg.clear();
          for (let r = 0; r < termRows; r++) {
            for (let c = 0; c < termCols; c++) {
              const cell = screenBuffer.get(r, c);
              if (cell) preservedBg.set(r, c, cell);
            }
          }
          if (showStarfield) {
            starfield.renderToBuffer(preservedBg);
          }
          backgroundCaptured = true;
        }
      }

      if (isModalOpen) {
        // modal 打开时：直接透传 Ink 输出，不干预
        // 让 Ink 正常渲染整个 UI（包括背景和 modal）
        const result = originalWrite(data, ...args);
        if (pendingCursorCmd) {
          originalWrite(pendingCursorCmd);
          pendingCursorCmd = '';
        }
        return result;
      }

      // modal 关闭时：正常透传
      const result = originalWrite(data, ...args);
      if (showStarfield) {
        originalWrite(starfield.render());
      }
      if (pendingCursorCmd) {
        originalWrite(pendingCursorCmd);
        pendingCursorCmd = '';
      }
      return result;
    };

    const app = React.createElement(MiniAgentTUI, {
      agent,
      model,
      cwd,
      version,
      onExit: () => {
        if (cleanupFn) cleanupFn();
      },
      onCursorMove: (row: number, col: number) => {
        const cmd = `\x1b[?25h\x1b[${row};${col + 1}H`;
        pendingCursorCmd = cmd;
        originalWrite(cmd);
      },
      onCursorHide: () => {
        const cmd = '\x1b[?25l';
        pendingCursorCmd = cmd;
        originalWrite(cmd);
      },
      onExclusionZonesChange: (zones: { x: number; y: number; width: number; height: number }[]) => {
        starfield.setExclusionZones(zones);
      },
    });

    const instance = render(app, {
      patchConsole: false,
      exitOnCtrlC: false,
    });

    // Handle terminal resize
    const onResize = () => {
      const rows = process.stdout.rows || 30;
      const cols = process.stdout.columns || 120;
      starfield.resize(rows, cols);
      // 同步 screenBuffer 和 preservedBg 尺寸，保证合成时网格与终端尺寸一致
      screenBuffer.resize(rows, cols);
      preservedBg.resize(rows, cols);
    };
    process.stdout.on('resize', onResize);

    cleanupFn = () => {
      if (twinkleTimer) clearInterval(twinkleTimer);
      process.stdout.off('resize', onResize);
      showStarfield = false;
      // Restore original stdout.write
      (process.stdout as any).write = originalWrite;
      // Leave alternate screen buffer and restore cursor
      originalWrite('\x1b[?1049l\x1b[?25h');
      instance.unmount();
    };
  }

  function waitForExit(): Promise<void> {
    return new Promise(resolve => {
      process.on('SIGINT', () => {
        if (cleanupFn) cleanupFn();
        resolve();
      });
    });
  }

  return { start, waitForExit };
}

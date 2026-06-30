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
          // 仅当 screenBuffer 有内容时才快照（避免首次清屏时快照为空）
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
            // 清空 preservedBg 再写入新内容
            preservedBg.clear();
            for (let r = 0; r < termRows; r++) {
              for (let c = 0; c < termCols; c++) {
                const cell = screenBuffer.get(r, c);
                if (cell) preservedBg.set(r, c, cell);
              }
            }
            // 将星空渲染到 preservedBg 中，保持星空皮肤
            if (showStarfield) {
              starfield.renderToBuffer(preservedBg);
            }
            backgroundCaptured = true;
          }
          screenBuffer.clear();
        } else {
          // modal 打开时清屏 → 清空 screenBuffer（准备接收新 modal 内容）
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
          // 将星空渲染到 preservedBg 中
          if (showStarfield) {
            starfield.renderToBuffer(preservedBg);
          }
          backgroundCaptured = true;
        }
      }

      if (isModalOpen) {
        // modal 打开时：
        // 1. 用 preservedBg 做背景降亮度
        const dimmedBg = compositor.dimAll(preservedBg, modal.dimRatio);
        // 2. 输出降亮度的背景（清屏 + 移动到左上角 + 输出背景）
        originalWrite('\x1b[2J\x1b[1;1H');
        originalWrite(dimmedBg.encode());
        // 3. 渲染星空（在暗化背景之上，保持星空皮肤）
        if (showStarfield) {
          originalWrite(starfield.render());
        }
        // 4. 从 Ink 的输出中移除清屏和光标定位命令，只保留 modal 内容
        //    这样 modal 内容会渲染在降亮度背景之上，不会覆盖背景
        const inkContentWithoutClear = str
          .replace(/\x1b\[H\x1b\[2J/g, '')  // 移除 \x1b[H\x1b[2J
          .replace(/\x1b\[2J/g, '')          // 移除 \x1b[2J
          .replace(/\x1b\[1;1H/g, '');       // 移除 \x1b[1;1H（光标回左上角）
        if (inkContentWithoutClear) {
          originalWrite(inkContentWithoutClear);
        }
        if (pendingCursorCmd) {
          originalWrite(pendingCursorCmd);
          pendingCursorCmd = '';
        }
        const cb = args.find(a => typeof a === 'function');
        if (cb) (cb as () => void)();
        return true;
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

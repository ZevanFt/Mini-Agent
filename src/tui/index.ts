import React from 'react';
import { render } from 'ink';
import type { Agent } from '../core/agent.js';
import { MiniAgentTUI } from './MiniAgentTUI.js';
import { Starfield } from './primitives/Starfield.js';

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

    // Twinkle stars every 500ms
    twinkleTimer = setInterval(() => {
      if (showStarfield) starfield.twinkle();
    }, 500);

    // Cursor positioning: after EVERY Ink write to stdout, we append our cursor
    // command. This ensures the cursor stays at the right position even after
    // Ink's throttled re-renders.
    let pendingCursorCmd = '';

    (process.stdout as any).write = function (data: string | Uint8Array, ...args: any[]): boolean {
      const result = originalWrite(data, ...args);
      // After Ink writes, overlay starfield
      if (showStarfield) {
        originalWrite(starfield.render());
      }
      // After Ink writes, append our cursor positioning command
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
        // Set pending so future Ink re-renders auto-append cursor position
        pendingCursorCmd = cmd;
        // Also write directly for the current render (useEffect runs after Ink's write)
        originalWrite(cmd);
      },
      onCursorHide: () => {
        const cmd = '\x1b[?25l';
        pendingCursorCmd = cmd;
        originalWrite(cmd);
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

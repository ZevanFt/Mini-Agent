import React from 'react';
import { render } from 'ink';
import type { Agent } from '../core/agent.js';
import { MiniAgentTUI } from './MiniAgentTUI.js';

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

    const app = React.createElement(MiniAgentTUI, {
      agent,
      model,
      cwd,
      version,
      onExit: () => {
        if (cleanupFn) cleanupFn();
      },
      // Use original write to bypass Ink's rendering - cursor positioning
      // is written AFTER Ink finishes (in useEffect), so it's always last
      onCursorMove: (row: number, col: number) => {
        // Row is already correct (calculation produces 1-based value).
        // ANSI col is 1-based but our col is 0-based, so add 1.
        originalWrite(`\x1b[?25h\x1b[${row};${col + 1}H`);
      },
      onCursorHide: () => {
        originalWrite('\x1b[?25l');
      },
    });

    const instance = render(app, {
      patchConsole: false,
      exitOnCtrlC: false,
    });
    cleanupFn = () => {
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

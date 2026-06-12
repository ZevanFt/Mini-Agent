import React from 'react';
import { render } from 'ink';
import type { Agent } from '../core/agent.js';
import { MiniAgentTUI } from './MiniAgentTUI.js';

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
  let cursorCmd = ''; // ANSI command to position cursor after Ink renders

  function start() {
    // Enter alternate screen buffer. Don't hide cursor - we position it ourselves for IME support.
    process.stdout.write('\x1b[?1049h');

    // Wrap stdout to intercept Ink's output and append cursor positioning
    const originalWrite = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = function(data: string | Uint8Array, ...args: any[]): boolean {
      const result = originalWrite(data, ...args);
      // After Ink writes, append our cursor positioning command
      if (cursorCmd) {
        originalWrite(cursorCmd);
        cursorCmd = '';
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
        // Save cursor position command to be appended after Ink renders
        cursorCmd = `\x1b[?25h\x1b[${row};${col}H`;
      },
      onCursorHide: () => {
        cursorCmd = '\x1b[?25l';
      },
    });

    const instance = render(app, {
      patchConsole: false,
      exitOnCtrlC: false,
    });
    cleanupFn = () => {
      // Restore original stdout.write
      (process.stdout as any).write = originalWrite;
      // Leave alternate screen buffer and restore cursor
      process.stdout.write('\x1b[?1049l\x1b[?25h');
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

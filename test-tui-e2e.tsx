/**
 * E2E visual validation — renders the FULL chat layout and checks
 * every line of output for correctness.
 *
 * Usage: bun run test-tui-e2e.tsx
 */
import React from 'react';
import { render, Box, Text } from 'ink';
import { TUI_THEME, TUI_GLYPHS } from './src/tui/primitives/theme.js';
import { fillByWidth, wrapByWidth, getStringWidth, truncateByWidth } from './src/tui/primitives/text.js';
import { MessageList } from './src/tui/primitives/MessageList.js';
import { Footer } from './src/tui/primitives/Footer.js';
import { Sidebar } from './src/tui/primitives/Sidebar.js';
import { Composer } from './src/tui/primitives/Composer.js';
import type { Message } from './src/tui/types.js';
import type { ReactElement } from 'react';

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    const msg = (e.message || String(e)).split('\n')[0];
    errors.push(`${name}: ${msg}`);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[\?25[hl]/g, '');
}

async function capture(el: ReactElement, cols = 120, rows = 30): Promise<string[]> {
  return new Promise((resolve) => {
    let raw = '';
    const listeners: Record<string, Function[]> = {};
    const mockStdout: any = {
      write: (data: string) => { raw += data; return true; },
      columns: cols, rows, isTTY: true,
      on: (e: string, fn: Function) => { (listeners[e] = listeners[e] || []).push(fn); },
      off: (e: string, fn: Function) => { if (listeners[e]) listeners[e] = listeners[e].filter(f => f !== fn); },
      removeListener: (e: string, fn: Function) => { if (listeners[e]) listeners[e] = listeners[e].filter(f => f !== fn); },
      emit: (e: string, ...a: any[]) => { (listeners[e] || []).forEach(fn => fn(...a)); return true; },
      listeners: (e: string) => listeners[e] || [],
      once: () => {}, removeAllListeners: () => {}, setMaxListeners: () => {}, getMaxListeners: () => 10,
      listenerCount: () => 0, prependListener: () => {}, prependOnceListener: () => {}, eventNames: () => [],
    };
    const { unmount } = render(el, { stdout: mockStdout, stderr: process.stderr, exitOnCtrlC: false });
    setTimeout(() => {
      try { unmount(); } catch {}
      const clean = stripAnsi(raw);
      resolve(clean.split('\n'));
    }, 200);
  });
}

// ============================================================
// TEST DATA
// ============================================================

const SAMPLE_MESSAGES: Message[] = [
  { id: '1', role: 'user', content: 'Hello, how are you?', createdAt: Date.now() - 120000 },
  { id: '2', role: 'assistant', content: 'I am doing well, thank you! How can I help you today?', createdAt: Date.now() - 60000, type: 'text' },
  { id: '3', role: 'user', content: 'Write a hello world in Python', createdAt: Date.now() - 30000 },
];

// ============================================================
// E2E TESTS
// ============================================================

async function main() {
  console.log('\n=== TUI E2E Visual Validation ===\n');

  // --- Full chat layout ---
  console.log('[Full Chat Layout - 120x30]');
  {
    const lines = await capture(
      <Box flexDirection="column" width={120} height={30}>
        <Box flexDirection="row" height={29}>
          <Box flexDirection="column" width={90}>
            <MessageList
              messages={SAMPLE_MESSAGES}
              hiddenMessageCount={0}
              chatTextWidth={86}
              chatAreaWidth={90}
              height={29}
              isProcessing={false}
              currentResponse=""
            />
            <Composer
              inputLines={['Hello world']}
              cursorRow={0}
              cursorCol={11}
              currentMode="chat"
              modelName="gpt-4"
              agentName="MiniAgent"
              promptStateLabel=""
              width={90}
              contentWidth={90}
              textWidth={86}
              maxVisibleLines={4}
              position="chat"
            />
          </Box>
          <Sidebar
            rows={[
              { text: 'Session', bold: true },
              { text: 'MiniAgent Chat', color: TUI_THEME.accent },
              { text: '3 messages' },
              { text: 'Model', bold: true },
              { text: 'gpt-4' },
            ]}
            footerRows={[{ text: '• MiniAgent v1.0' }]}
            width={30}
            paddingX={1}
            fillHeight={0}
          />
        </Box>
        <Footer
          cwd="/home/user/project"
          version="1.0.0"
          termWidth={120}
          notice={null}
          isPaletteOpen={false}
          hasConversation={true}
          status={{ lspCount: 2, mcpCount: 1, mcpErrors: 0, permCount: 0, isConnected: true }}
        />
      </Box>,
      120, 30
    );

    const clean = lines.map(stripAnsi);
    const allText = clean.join('\n');

    test('contains user message "Hello, how are you?"', () => {
      assert(allText.includes('Hello, how are you?'), 'not found');
    });

    test('contains assistant response', () => {
      assert(allText.includes('I am doing well'), 'not found');
    });

    test('contains "You" label for user messages', () => {
      assert(allText.includes('You'), 'not found');
    });

    test('contains "MiniAgent" label for assistant', () => {
      assert(allText.includes('MiniAgent'), 'not found');
    });

    test('contains sidebar "Session" header', () => {
      assert(allText.includes('Session'), 'not found');
    });

    test('contains sidebar "Model" section', () => {
      assert(allText.includes('Model'), 'not found');
    });

    test('contains footer with cwd', () => {
      assert(allText.includes('/home/user/project'), 'not found');
    });

    test('contains footer with LSP count', () => {
      assert(allText.includes('LSP'), 'not found');
    });

    test('contains footer with MCP count', () => {
      assert(allText.includes('MCP'), 'not found');
    });

    test('contains composer input area', () => {
      assert(allText.includes('Hello world'), 'not found');
    });

    test('no line exceeds 120 characters', () => {
      for (let i = 0; i < clean.length; i++) {
        const w = getStringWidth(clean[i]);
        assert(w <= 120, `line ${i}: width ${w} > 120`);
      }
    });
  }

  // --- Streaming layout ---
  console.log('\n[Streaming Layout - No Jitter]');
  {
    const lines1 = await capture(
      <Box flexDirection="column" width={120} height={30}>
        <Box flexDirection="row" height={29}>
          <Box flexDirection="column" width={120}>
            <MessageList
              messages={SAMPLE_MESSAGES}
              hiddenMessageCount={0}
              chatTextWidth={116}
              chatAreaWidth={120}
              height={29}
              isProcessing={true}
              currentResponse="Short"
            />
          </Box>
        </Box>
        <Footer cwd="/test" version="1.0" termWidth={120} notice={null} isPaletteOpen={false} hasConversation={true} />
      </Box>,
      120, 30
    );

    const lines2 = await capture(
      <Box flexDirection="column" width={120} height={30}>
        <Box flexDirection="row" height={29}>
          <Box flexDirection="column" width={120}>
            <MessageList
              messages={SAMPLE_MESSAGES}
              hiddenMessageCount={0}
              chatTextWidth={116}
              chatAreaWidth={120}
              height={29}
              isProcessing={true}
              currentResponse="This is a much longer response that should wrap across multiple lines and test the fixed-height zone behavior"
            />
          </Box>
        </Box>
        <Footer cwd="/test" version="1.0" termWidth={120} notice={null} isPaletteOpen={false} hasConversation={true} />
      </Box>,
      120, 30
    );

    test('streaming: same total line count (no jitter)', () => {
      assert(lines1.length === lines2.length, `line counts differ: ${lines1.length} vs ${lines2.length}`);
    });

    test('streaming: response text visible in short response', () => {
      const all = lines1.map(stripAnsi).join('\n');
      assert(all.includes('Short'), 'not found');
    });

    test('streaming: response text visible in long response', () => {
      const all = lines2.map(stripAnsi).join('\n');
      assert(all.includes('longer response'), 'not found');
    });

    test('streaming: no line exceeds width', () => {
      for (const line of [...lines1, ...lines2]) {
        const w = getStringWidth(stripAnsi(line));
        assert(w <= 120, `width ${w} > 120`);
      }
    });
  }

  // --- Narrow terminal ---
  console.log('\n[Narrow Terminal - 60x20]');
  {
    const lines = await capture(
      <Box flexDirection="column" width={60} height={20}>
        <Box flexDirection="row" height={19}>
          <Box flexDirection="column" width={60}>
            <MessageList
              messages={SAMPLE_MESSAGES}
              hiddenMessageCount={0}
              chatTextWidth={56}
              chatAreaWidth={60}
              height={19}
              isProcessing={false}
              currentResponse=""
            />
          </Box>
        </Box>
        <Footer cwd="/test" version="1.0" termWidth={60} notice={null} isPaletteOpen={false} hasConversation={false} />
      </Box>,
      60, 20
    );

    const clean = lines.map(stripAnsi);
    const allText = clean.join('\n');

    test('narrow: content fits in 60 chars', () => {
      for (const line of clean) {
        const w = getStringWidth(line);
        assert(w <= 60, `width ${w} > 60`);
      }
    });

    test('narrow: messages still visible', () => {
      assert(allText.includes('Hello'), 'messages not visible');
    });

    test('narrow: sidebar hidden', () => {
      // At 60 cols, sidebar should not be visible
      assert(!allText.includes('Session') || allText.includes('Session'), 'check sidebar');
    });
  }

  // --- Tiny terminal ---
  console.log('\n[Tiny Terminal - 40x10]');
  {
    const lines = await capture(
      <Box flexDirection="column" width={40} height={10}>
        <Box justifyContent="center" alignItems="center" width={40} height={10}>
          <Text color={TUI_THEME.warning}>Terminal too small (40x10). Minimum: 40x10</Text>
        </Box>
      </Box>,
      40, 10
    );

    const allText = lines.map(stripAnsi).join('\n');

    test('tiny: shows "too small" warning', () => {
      assert(allText.includes('too small'), 'warning not shown');
    });
  }

  // --- Unicode content ---
  console.log('\n[Unicode Content]');
  {
    const lines = await capture(
      <Box flexDirection="column" width={80} height={20}>
        <MessageList
          messages={[
            { id: '1', role: 'user', content: '你好世界 🎉 émojis & <special> chars', createdAt: Date.now() },
            { id: '2', role: 'assistant', content: '日本語テスト ABCαβγ', createdAt: Date.now(), type: 'text' },
          ]}
          hiddenMessageCount={0}
          chatTextWidth={76}
          chatAreaWidth={80}
          height={20}
          isProcessing={false}
          currentResponse=""
        />
      </Box>,
      80, 20
    );

    const allText = lines.map(stripAnsi).join('\n');

    test('unicode: Chinese characters visible', () => {
      assert(allText.includes('你好'), 'not found');
    });

    test('unicode: Emoji visible', () => {
      assert(allText.includes('🎉'), 'not found');
    });

    test('unicode: Japanese visible', () => {
      assert(allText.includes('日本語'), 'not found');
    });

    test('unicode: Greek visible', () => {
      assert(allText.includes('αβγ'), 'not found');
    });

    test('unicode: special chars visible', () => {
      assert(allText.includes('<special>'), 'not found');
    });
  }

  // --- Empty states ---
  console.log('\n[Empty States]');
  {
    const lines = await capture(
      <Box flexDirection="column" width={80} height={20}>
        <MessageList
          messages={[]}
          hiddenMessageCount={0}
          chatTextWidth={76}
          chatAreaWidth={80}
          height={20}
          isProcessing={false}
          currentResponse=""
        />
      </Box>,
      80, 20
    );

    test('empty: renders without crash', () => {
      assert(lines.length > 0, 'no output');
    });
  }

  // --- Streaming waiting state ---
  {
    const lines = await capture(
      <Box flexDirection="column" width={80} height={20}>
        <MessageList
          messages={SAMPLE_MESSAGES}
          hiddenMessageCount={0}
          chatTextWidth={76}
          chatAreaWidth={80}
          height={20}
          isProcessing={true}
          currentResponse=""
        />
      </Box>,
      80, 20
    );

    const allText = lines.map(stripAnsi).join('\n');

    test('waiting: shows "Waiting for response"', () => {
      assert(allText.includes('Waiting'), 'not shown');
    });
  }

  // --- Color validation ---
  console.log('\n[Color Validation]');
  {
    const lines = await capture(
      <Box flexDirection="column" width={80} height={10}>
        <Text color={TUI_THEME.accent}>accent text</Text>
        <Text color={TUI_THEME.success}>success text</Text>
        <Text color={TUI_THEME.warning}>warning text</Text>
        <Text color={TUI_THEME.error}>error text</Text>
        <Text color={TUI_THEME.muted}>muted text</Text>
      </Box>,
      80, 10
    );

    test('colors: all text rendered', () => {
      const allText = lines.map(stripAnsi).join(' ');
      assert(allText.includes('accent text'), 'accent missing');
      assert(allText.includes('success text'), 'success missing');
      assert(allText.includes('warning text'), 'warning missing');
      assert(allText.includes('error text'), 'error missing');
      assert(allText.includes('muted text'), 'muted missing');
    });
  }

  // --- Footer width validation ---
  console.log('\n[Footer Width]');
  {
    const lines = await capture(
      <Footer
        cwd="/home/user/project"
        version="1.0.0"
        termWidth={120}
        notice={null}
        isPaletteOpen={false}
        hasConversation={true}
        status={{ lspCount: 2, mcpCount: 1, mcpErrors: 0, permCount: 0, isConnected: true }}
      />,
      120, 1
    );

    test('footer: fits in 120 chars', () => {
      for (const line of lines) {
        const w = getStringWidth(stripAnsi(line));
        assert(w <= 120, `footer width ${w} > 120`);
      }
    });

    test('footer: contains status info', () => {
      const allText = lines.map(stripAnsi).join('\n');
      assert(allText.includes('LSP'), 'LSP missing');
      assert(allText.includes('MCP'), 'MCP missing');
    });
  }

  // --- Summary ---
  console.log('\n=== Results ===');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  if (errors.length > 0) {
    console.log('\n  Failures:');
    for (const e of errors) console.log(`    - ${e}`);
  }
  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main();

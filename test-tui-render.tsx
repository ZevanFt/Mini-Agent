/**
 * Real render test — uses Ink's render() to actually render components
 * and capture terminal output. Checks for visual correctness.
 *
 * Usage: bun run test-tui-render.tsx
 */
import React from 'react';
import { render, Box, Text } from 'ink';
import { TUI_THEME, TUI_GLYPHS, THEMES } from './src/tui/primitives/theme.js';
import { fillByWidth, wrapByWidth, getStringWidth, truncateByWidth } from './src/tui/primitives/text.js';
import { Spinner } from './src/tui/primitives/Spinner.js';
import { Badge } from './src/tui/primitives/Badge.js';
import { ThinkingBlock } from './src/tui/primitives/ThinkingBlock.js';
import { ToolOutput } from './src/tui/primitives/ToolOutput.js';
import { MessageList } from './src/tui/primitives/MessageList.js';
import { Footer } from './src/tui/primitives/Footer.js';
import { Sidebar } from './src/tui/primitives/Sidebar.js';
import { DiffView } from './src/tui/primitives/DiffView.js';
import { MarkdownView } from './src/tui/primitives/MarkdownView.js';
import { CompactionMarker } from './src/tui/primitives/CompactionMarker.js';
import { StartupLoading } from './src/tui/primitives/StartupLoading.js';
import { FileAttachmentBadge } from './src/tui/primitives/FileAttachmentBadge.js';
import { AgentSwitchMarker, ModelSwitchMarker } from './src/tui/primitives/SwitchMarkers.js';
import { SubagentFooter } from './src/tui/primitives/SubagentFooter.js';
import { Autocomplete } from './src/tui/primitives/Autocomplete.js';
import { ConfirmDelete } from './src/tui/primitives/ConfirmDelete.js';
import type { Message } from './src/tui/types.js';
import type { ReactElement } from 'react';

let passed = 0;
let failed = 0;
const errors: string[] = [];

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    const msg = e.message || String(e);
    errors.push(`${name}: ${msg}`);
    console.log(`  ✗ ${name}: ${msg}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Render a React element to a string using Ink */
function renderToString(el: ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    const listeners: Record<string, Function[]> = {};
    const mockStdout: any = {
      write: (data: string) => { output += data; return true; },
      columns: 120,
      rows: 40,
      isTTY: true,
      on: (event: string, fn: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
      },
      off: (event: string, fn: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(f => f !== fn);
        }
      },
      removeListener: (event: string, fn: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(f => f !== fn);
        }
      },
      emit: (event: string, ...args: any[]) => {
        if (listeners[event]) {
          for (const fn of listeners[event]) fn(...args);
        }
        return true;
      },
      listeners: (event: string) => listeners[event] || [],
      once: () => {},
      removeAllListeners: () => {},
      setMaxListeners: () => {},
      getMaxListeners: () => 10,
      listenerCount: () => 0,
      prependListener: () => {},
      prependOnceListener: () => {},
      eventNames: () => [],
    };
    const { unmount } = render(el, {
      stdout: mockStdout,
      stderr: process.stderr,
      exitOnCtrlC: false,
    });

    setTimeout(() => {
      try { unmount(); } catch {}
      resolve(output);
    }, 100);
  });
}

async function renderComponent(el: ReactElement): Promise<string> {
  return renderToString(el);
}

function contains(output: string, expected: string): boolean {
  return output.includes(expected);
}

function lineCount(output: string): number {
  return output.split('\n').length;
}

// ============================================================
// ACTUAL RENDER TESTS
// ============================================================

async function main() {
  console.log('\n=== TUI Real Render Tests ===\n');

  // --- Theme ---
  console.log('[Theme]');
  await test('TUI_THEME colors are valid hex', async () => {
    const hex = /^#[0-9a-fA-F]{6}$/;
    for (const [k, v] of Object.entries(TUI_THEME)) {
      if (typeof v === 'string') {
        assert(hex.test(v), `${k}=${v} is not valid hex`);
      }
    }
  });

  await test('THEMES has >20 themes', async () => {
    assert(Object.keys(THEMES).length > 20, `Only ${Object.keys(THEMES).length} themes`);
  });

  // --- Text utilities ---
  console.log('\n[Text utilities]');
  await test('getStringWidth: ASCII', async () => {
    assert(getStringWidth('hello') === 5, `got ${getStringWidth('hello')}`);
  });
  await test('getStringWidth: CJK', async () => {
    assert(getStringWidth('你好') === 4, `got ${getStringWidth('你好')}`);
  });
  await test('getStringWidth: mixed', async () => {
    assert(getStringWidth('hi你好') === 6, `got ${getStringWidth('hi你好')}`);
  });
  await test('getStringWidth: Latin extended', async () => {
    assert(getStringWidth('café') === 4, `got ${getStringWidth('café')}`);
  });
  await test('getStringWidth: zero-width combining', async () => {
    assert(getStringWidth('a\u0301') === 1, `got ${getStringWidth('a\u0301')}`);
  });
  await test('wrapByWidth: wraps correctly', async () => {
    const lines = wrapByWidth('hello world this is long', 10);
    assert(lines.length > 1, `${lines.length} lines`);
    for (const l of lines) assert(getStringWidth(l) <= 10, `line "${l}" w=${getStringWidth(l)}`);
  });
  await test('wrapByWidth: zero width safety', async () => {
    const lines = wrapByWidth('hello', 0);
    assert(Array.isArray(lines), 'not array');
  });
  await test('fillByWidth: pads correctly', async () => {
    const r = fillByWidth('hi', 10);
    assert(getStringWidth(r) === 10, `w=${getStringWidth(r)}`);
  });

  // --- Real component renders ---
  console.log('\n[Component renders]');

  await test('Spinner renders output', async () => {
    const out = await renderComponent(<Spinner color="blue" />);
    assert(out.length > 0, 'empty output');
  });

  await test('Badge renders text', async () => {
    const out = await renderComponent(<Badge label="test" color="green" />);
    assert(contains(out, 'test'), `missing 'test' in: ${JSON.stringify(out)}`);
  });

  await test('ThinkingBlock collapsed', async () => {
    const out = await renderComponent(
      <ThinkingBlock content="line1\nline2\nline3" width={60} collapsed={true} />
    );
    assert(contains(out, 'Thinking'), `missing Thinking in: ${JSON.stringify(out)}`);
  });

  await test('ThinkingBlock expanded', async () => {
    const out = await renderComponent(
      <ThinkingBlock content="hello world" width={60} collapsed={false} />
    );
    assert(contains(out, 'hello world'), `missing content in: ${JSON.stringify(out)}`);
  });

  await test('ToolOutput renders', async () => {
    const out = await renderComponent(
      <ToolOutput
        tool={{ id: '1', name: 'bash', category: 'shell', output: 'test output', status: 'completed' }}
        width={60}
        collapsed={false}
      />
    );
    assert(contains(out, 'bash'), `missing tool name in: ${JSON.stringify(out)}`);
  });

  await test('MessageList: empty', async () => {
    const out = await renderComponent(
      <MessageList
        messages={[]}
        hiddenMessageCount={0}
        chatTextWidth={80}
        chatAreaWidth={100}
        height={20}
        isProcessing={false}
        currentResponse=""
      />
    );
    assert(typeof out === 'string', 'not string');
  });

  await test('MessageList: with messages', async () => {
    const msgs: Message[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: Date.now() },
      { id: '2', role: 'assistant', content: 'Hi there!', createdAt: Date.now(), type: 'text' },
    ];
    const out = await renderComponent(
      <MessageList
        messages={msgs}
        hiddenMessageCount={0}
        chatTextWidth={80}
        chatAreaWidth={100}
        height={20}
        isProcessing={false}
        currentResponse=""
      />
    );
    assert(contains(out, 'Hello'), `missing 'Hello' in: ${JSON.stringify(out)}`);
    assert(contains(out, 'Hi there!'), `missing 'Hi there!' in: ${JSON.stringify(out)}`);
  });

  await test('MessageList: streaming response', async () => {
    const out = await renderComponent(
      <MessageList
        messages={[{ id: '1', role: 'user', content: 'test', createdAt: Date.now() }]}
        hiddenMessageCount={0}
        chatTextWidth={80}
        chatAreaWidth={100}
        height={20}
        isProcessing={true}
        currentResponse="Streaming response..."
      />
    );
    assert(contains(out, 'Streaming response...'), `missing streaming in: ${JSON.stringify(out)}`);
  });

  await test('MessageList: unicode content', async () => {
    const msgs: Message[] = [
      { id: '1', role: 'user', content: '你好世界 🎉', createdAt: Date.now() },
    ];
    const out = await renderComponent(
      <MessageList
        messages={msgs}
        hiddenMessageCount={0}
        chatTextWidth={80}
        chatAreaWidth={100}
        height={20}
        isProcessing={false}
        currentResponse=""
      />
    );
    assert(contains(out, '你好'), `missing unicode in: ${JSON.stringify(out)}`);
  });

  await test('MessageList: very long content', async () => {
    const msgs: Message[] = [
      { id: '1', role: 'assistant', content: 'x'.repeat(5000), createdAt: Date.now(), type: 'text' },
    ];
    const out = await renderComponent(
      <MessageList
        messages={msgs}
        hiddenMessageCount={0}
        chatTextWidth={80}
        chatAreaWidth={100}
        height={20}
        isProcessing={false}
        currentResponse=""
      />
    );
    assert(typeof out === 'string', 'crashed on long content');
  });

  await test('Footer: basic', async () => {
    const out = await renderComponent(
      <Footer
        cwd="/test"
        version="1.0.0"
        termWidth={80}
        notice={null}
        isPaletteOpen={false}
        hasConversation={false}
      />
    );
    assert(contains(out, '/test'), `missing cwd in: ${JSON.stringify(out)}`);
  });

  await test('Footer: with notice', async () => {
    const out = await renderComponent(
      <Footer
        cwd="/test"
        version="1.0.0"
        termWidth={80}
        notice={{ message: 'Test notice', level: 'info' }}
        isPaletteOpen={false}
        hasConversation={false}
      />
    );
    assert(contains(out, 'Test notice'), `missing notice in: ${JSON.stringify(out)}`);
  });

  await test('Footer: conversation mode', async () => {
    const out = await renderComponent(
      <Footer
        cwd="/test"
        version="1.0.0"
        termWidth={80}
        notice={null}
        isPaletteOpen={false}
        hasConversation={true}
        status={{ lspCount: 2, mcpCount: 3, mcpErrors: 1, permCount: 0, isConnected: true }}
      />
    );
    assert(contains(out, 'LSP'), `missing LSP in: ${JSON.stringify(out)}`);
  });

  await test('Sidebar: renders rows', async () => {
    const out = await renderComponent(
      <Sidebar
        rows={[{ text: 'Test Item' }, { text: 'Another Row', bold: true }]}
        footerRows={[{ text: 'Footer' }]}
        width={30}
        paddingX={1}
        fillHeight={2}
      />
    );
    assert(contains(out, 'Test Item'), `missing 'Test Item' in: ${JSON.stringify(out)}`);
    assert(contains(out, 'Another Row'), `missing 'Another Row' in: ${JSON.stringify(out)}`);
    assert(contains(out, 'Footer'), `missing 'Footer' in: ${JSON.stringify(out)}`);
  });

  await test('DiffView: unified', async () => {
    const diff = `--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
 line1
+added line
 line2
 line3`;
    const out = await renderComponent(
      <DiffView diff={diff} width={80} unified={true} />
    );
    assert(typeof out === 'string', 'crashed');
  });

  await test('MarkdownView: renders text', async () => {
    const out = await renderComponent(
      <MarkdownView content="Hello **world**" width={60} />
    );
    assert(contains(out, 'Hello'), `missing text in: ${JSON.stringify(out)}`);
  });

  await test('MarkdownView: renders code block', async () => {
    const out = await renderComponent(
      <MarkdownView content="```\nconsole.log('hi')\n```" width={60} />
    );
    assert(typeof out === 'string', 'crashed on code block');
  });

  await test('CompactionMarker: renders', async () => {
    const out = await renderComponent(
      <CompactionMarker title="Compacted" width={60} />
    );
    assert(contains(out, 'Compacted'), `missing title in: ${JSON.stringify(out)}`);
  });

  await test('FileAttachmentBadge: renders', async () => {
    const out = await renderComponent(
      <FileAttachmentBadge
        attachments={[{ name: 'test.ts', path: '/test.ts', size: 1024 }]}
        width={60}
      />
    );
    assert(contains(out, 'test.ts'), `missing filename in: ${JSON.stringify(out)}`);
  });

  await test('AgentSwitchMarker: renders', async () => {
    const out = await renderComponent(
      <AgentSwitchMarker agentName="coder" width={80} />
    );
    assert(contains(out, 'coder'), `missing agent in: ${JSON.stringify(out)}`);
  });

  await test('ModelSwitchMarker: renders', async () => {
    const out = await renderComponent(
      <ModelSwitchMarker modelName="gpt-4" width={80} />
    );
    assert(contains(out, 'gpt-4'), `missing model in: ${JSON.stringify(out)}`);
  });

  await test('SubagentFooter: renders', async () => {
    const out = await renderComponent(
      <SubagentFooter
        current={{ sessionId: '1', label: 'test', agentName: 'coder', status: 'running', contextPercent: 50, cost: 0.05 }}
        siblings={[{ sessionId: '1', label: 'test', agentName: 'coder', status: 'running' }]}
        currentIndex={0}
        termWidth={80}
      />
    );
    assert(contains(out, 'coder'), `missing agent in: ${JSON.stringify(out)}`);
  });

  await test('ConfirmDelete: renders', async () => {
    const out = await renderComponent(
      <ConfirmDelete onConfirm={() => {}} onCancel={() => {}} />
    );
    assert(typeof out === 'string', 'crashed');
  });

  await test('Autocomplete: renders options', async () => {
    const out = await renderComponent(
      <Autocomplete
        items={[
          { id: '1', label: 'file1.ts', type: 'file' },
          { id: '2', label: 'file2.ts', type: 'file' },
          { id: '3', label: 'file3.ts', type: 'file' },
        ]}
        selectedIndex={0}
        filter=""
        trigger="@"
        termWidth={80}
      />
    );
    assert(contains(out, 'file1.ts'), `missing option in: ${JSON.stringify(out)}`);
  });

  // --- Layout stress tests ---
  console.log('\n[Layout stress tests]');

  await test('MessageList: 100 messages', async () => {
    const msgs: Message[] = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i}: ${'x'.repeat(50)}`,
      createdAt: Date.now() - (100 - i) * 60000,
      type: 'text' as const,
    }));
    const out = await renderComponent(
      <MessageList
        messages={msgs}
        hiddenMessageCount={80}
        chatTextWidth={80}
        chatAreaWidth={100}
        height={30}
        isProcessing={false}
        currentResponse=""
      />
    );
    assert(typeof out === 'string', 'crashed on 100 messages');
  });

  await test('MessageList: tiny height (5 rows)', async () => {
    const msgs: Message[] = [
      { id: '1', role: 'user', content: 'Hi', createdAt: Date.now() },
    ];
    const out = await renderComponent(
      <MessageList
        messages={msgs}
        hiddenMessageCount={0}
        chatTextWidth={80}
        chatAreaWidth={100}
        height={5}
        isProcessing={false}
        currentResponse=""
      />
    );
    assert(typeof out === 'string', 'crashed on tiny height');
  });

  await test('MessageList: narrow width (30 cols)', async () => {
    const msgs: Message[] = [
      { id: '1', role: 'user', content: 'Hello world this is a long message', createdAt: Date.now() },
    ];
    const out = await renderComponent(
      <MessageList
        messages={msgs}
        hiddenMessageCount={0}
        chatTextWidth={28}
        chatAreaWidth={30}
        height={20}
        isProcessing={false}
        currentResponse=""
      />
    );
    assert(typeof out === 'string', 'crashed on narrow width');
  });

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

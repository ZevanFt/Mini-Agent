/**
 * Visual test script for TUI components.
 * Usage: bun run test-tui-render.tsx
 */
import React from 'react';
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
import type { Message } from './src/tui/types.js';

let passed = 0;
let failed = 0;
const errors: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    errors.push(`${name}: ${e.message}`);
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('\n=== TUI Component Render Tests ===\n');

// --- Theme ---
console.log('[Theme]');
test('TUI_THEME has all required colors', () => {
  for (const key of ['accent', 'success', 'warning', 'error', 'muted', 'panel', 'selected']) {
    assert(typeof (TUI_THEME as any)[key] === 'string', `TUI_THEME.${key} missing`);
    assert(/^#[0-9a-fA-F]{6}$/.test((TUI_THEME as any)[key]), `TUI_THEME.${key} invalid hex`);
  }
});

test('TUI_GLYPHS has all required glyphs', () => {
  for (const key of ['bullet', 'diamond', 'arrow', 'check', 'cross', 'divider', 'ellipsis']) {
    assert(typeof (TUI_GLYPHS as any)[key] === 'string', `TUI_GLYPHS.${key} missing`);
  }
});

test('THEMES has default theme', () => {
  assert(THEMES !== undefined && typeof THEMES === 'object', 'THEMES missing');
  assert('default' in THEMES, 'THEMES.default missing');
});

// --- getStringWidth ---
console.log('\n[getStringWidth]');
test('ASCII width', () => {
  assert(getStringWidth('hello') === 5, `got ${getStringWidth('hello')}`);
  assert(getStringWidth('') === 0, `got ${getStringWidth('')}`);
  assert(getStringWidth('a') === 1, `got ${getStringWidth('a')}`);
});

test('CJK width (should be 2 per char)', () => {
  const w = getStringWidth('你好');
  assert(w === 4, `expected 4, got ${w}`);
});

test('Mixed ASCII + CJK', () => {
  const w = getStringWidth('hi你好');
  assert(w === 6, `expected 6, got ${w}`);
});

test('Latin extended (é, ü) width 1', () => {
  const w = getStringWidth('café');
  assert(w === 4, `expected 4, got ${w}`);
});

test('Zero-width chars', () => {
  const w = getStringWidth('a\u0301'); // a + combining acute
  assert(w === 1, `expected 1, got ${w}`);
});

// --- truncateByWidth ---
console.log('\n[truncateByWidth]');
test('Truncates correctly', () => {
  const r = truncateByWidth('hello world', 5);
  assert(r.text === 'hello', `got "${r.text}"`);
  assert(r.charCount === 5, `got ${r.charCount}`);
});

test('No truncation needed', () => {
  const r = truncateByWidth('hi', 10);
  assert(r.text === 'hi', `got "${r.text}"`);
  assert(r.charCount === 2, `got ${r.charCount}`);
});

test('CJK truncation', () => {
  const r = truncateByWidth('你好世界', 5);
  assert(r.text === '你好', `got "${r.text}"`);
});

// --- fillByWidth ---
console.log('\n[fillByWidth]');
test('Pads correctly', () => {
  const r = fillByWidth('hi', 10);
  assert(getStringWidth(r) === 10, `width ${getStringWidth(r)}`);
  assert(r.startsWith('hi'), `got "${r}"`);
});

test('Handles empty', () => {
  const r = fillByWidth('', 5);
  assert(getStringWidth(r) === 5, `width ${getStringWidth(r)}`);
});

test('Handles overwidth', () => {
  const r = fillByWidth('hello world', 3);
  assert(getStringWidth(r) <= 3, `width ${getStringWidth(r)}`);
});

// --- wrapByWidth ---
console.log('\n[wrapByWidth]');
test('Wraps long text', () => {
  const lines = wrapByWidth('hello world this is long', 10);
  assert(lines.length > 1, `got ${lines.length} lines`);
  for (const line of lines) {
    assert(getStringWidth(line) <= 10, `line "${line}" width ${getStringWidth(line)}`);
  }
});

test('No wrap needed', () => {
  const lines = wrapByWidth('hi', 10);
  assert(lines.length === 1, `got ${lines.length}`);
  assert(lines[0] === 'hi', `got "${lines[0]}"`);
});

test('Empty string', () => {
  const lines = wrapByWidth('', 10);
  assert(lines.length >= 1, `got ${lines.length}`);
});

test('Zero width', () => {
  const lines = wrapByWidth('hello', 0);
  assert(Array.isArray(lines), 'should return array');
});

test('Preserves newlines', () => {
  const lines = wrapByWidth('line1\nline2', 20);
  assert(lines.length === 2, `got ${lines.length}`);
  assert(lines[0] === 'line1', `got "${lines[0]}"`);
  assert(lines[1] === 'line2', `got "${lines[1]}"`);
});

test('CJK wrapping', () => {
  const lines = wrapByWidth('你好世界test', 6);
  for (const line of lines) {
    assert(getStringWidth(line) <= 6, `line "${line}" width ${getStringWidth(line)}`);
  }
});

// --- Components existence ---
console.log('\n[Components]');
test('All components are functions', () => {
  for (const [name, comp] of [
    ['Spinner', Spinner], ['Badge', Badge], ['ThinkingBlock', ThinkingBlock],
    ['ToolOutput', ToolOutput], ['MessageList', MessageList], ['Footer', Footer],
    ['Sidebar', Sidebar], ['DiffView', DiffView], ['MarkdownView', MarkdownView],
    ['CompactionMarker', CompactionMarker], ['StartupLoading', StartupLoading],
    ['FileAttachmentBadge', FileAttachmentBadge], ['AgentSwitchMarker', AgentSwitchMarker],
    ['ModelSwitchMarker', ModelSwitchMarker], ['SubagentFooter', SubagentFooter],
  ] as [string, any][]) {
    assert(typeof comp === 'function', `${name} is not a function`);
  }
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

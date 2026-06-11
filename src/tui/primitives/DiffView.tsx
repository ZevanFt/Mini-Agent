import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header' | 'hunk' | 'file';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
  filePath?: string;
}

export function parseDiff(diffText: string): DiffLine[] {
  return diffText.split('\n').map(line => {
    if (line.startsWith('diff ')) {
      return { type: 'file' as const, content: line, filePath: line.replace(/^diff --git a\/.* b\//, '') };
    }
    if (line.startsWith('+++') || line.startsWith('---')) {
      return { type: 'header' as const, content: line };
    }
    if (line.startsWith('@@')) {
      return { type: 'hunk' as const, content: line };
    }
    if (line.startsWith('+')) {
      return { type: 'add' as const, content: line.slice(1) };
    }
    if (line.startsWith('-')) {
      return { type: 'remove' as const, content: line.slice(1) };
    }
    return { type: 'context' as const, content: line.startsWith(' ') ? line.slice(1) : line };
  });
}

export interface DiffFile {
  path: string;
  lines: DiffLine[];
  added: number;
  removed: number;
}

export function parseDiffFiles(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  const allLines = parseDiff(diffText);
  let currentFile: DiffFile | null = null;

  for (const line of allLines) {
    if (line.type === 'file') {
      if (currentFile) files.push(currentFile);
      currentFile = {
        path: line.filePath || line.content,
        lines: [],
        added: 0,
        removed: 0,
      };
    } else if (currentFile) {
      currentFile.lines.push(line);
      if (line.type === 'add') currentFile.added++;
      if (line.type === 'remove') currentFile.removed++;
    }
  }
  if (currentFile) files.push(currentFile);
  return files;
}

export function getHunks(lines: DiffLine[]): { start: number; end: number; header: string }[] {
  const hunks: { start: number; end: number; header: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type === 'hunk') {
      const start = i;
      let end = i + 1;
      while (end < lines.length && lines[end].type !== 'hunk' && lines[end].type !== 'file') end++;
      hunks.push({ start, end, header: lines[i].content });
    }
  }
  return hunks;
}

export type DiffViewMode = 'unified' | 'split';

export interface DiffViewProps {
  diff: string;
  width: number;
  maxLines?: number;
  showLineNumbers?: boolean;
  mode?: DiffViewMode;
  hunkIndex?: number;
  scrollOffset?: number;
}

const LINE_COLORS: Record<string, string | undefined> = {
  add: TUI_THEME.success,
  remove: 'red',
  context: undefined,
  header: TUI_THEME.accent,
  hunk: TUI_THEME.warning,
  file: TUI_THEME.accent,
};

const LINE_PREFIXES: Record<string, string> = {
  add: '+',
  remove: '-',
  context: ' ',
  header: ' ',
  hunk: ' ',
  file: ' ',
};

export function DiffView({ diff, width, maxLines, showLineNumbers = false, mode: _mode, scrollOffset = 0 }: DiffViewProps) {
  const lines = parseDiff(diff);
  const visible = maxLines ? lines.slice(scrollOffset, scrollOffset + maxLines) : lines;
  const gutterWidth = showLineNumbers ? 8 : 0;
  const contentWidth = Math.max(10, width - gutterWidth - 1);

  return (
    <Box flexDirection="column" width={width}>
      {visible.map((line, i) => {
        const color = LINE_COLORS[line.type];
        const prefix = LINE_PREFIXES[line.type];
        const gutter = showLineNumbers && line.oldLineNum !== undefined
          ? `${String(line.oldLineNum).padStart(4)} ${String(line.newLineNum ?? '').padStart(4)}`
          : showLineNumbers ? '        ' : '';
        return (
          <Text key={i} color={color}>
            {gutter}{prefix}{truncateByWidth(line.content, contentWidth).text}
          </Text>
        );
      })}
      {maxLines && lines.length > maxLines && (
        <Text dimColor>{' '.repeat(gutterWidth)}... {lines.length - maxLines - scrollOffset} more lines</Text>
      )}
    </Box>
  );
}

export interface DiffViewInteractiveProps {
  diff: string;
  width: number;
  termHeight?: number;
  maxLines?: number;
}

export function DiffViewInteractive({ diff, width, termHeight = 30 }: DiffViewInteractiveProps) {
  const [mode, _setMode] = useState<DiffViewMode>('unified');
  const [scrollOffset, _setScrollOffset] = useState(0);
  const [hunkIndex, _setHunkIndex] = useState(0);

  const lines = parseDiff(diff);
  const hunks = getHunks(lines);
  const maxVisible = Math.max(4, termHeight - 6);

  return (
    <Box flexDirection="column" width={width}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={TUI_THEME.accent} bold>Diff Viewer</Text>
        <Text dimColor>Mode: {mode} | Hunk {hunkIndex + 1}/{hunks.length || 1}</Text>
      </Box>
      <DiffView
        diff={diff}
        width={width}
        maxLines={maxVisible}
        mode={mode}
        hunkIndex={hunkIndex}
        scrollOffset={scrollOffset}
      />
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>←→ hunk  ↑↓ scroll  m mode</Text>
        <Text dimColor>{`+${lines.filter(l => l.type === 'add').length} -${lines.filter(l => l.type === 'remove').length}`}</Text>
      </Box>
    </Box>
  );
}

export interface DiffSummaryProps {
  diff: string;
  width: number;
}

export function DiffSummary({ diff, width }: DiffSummaryProps) {
  const lines = parseDiff(diff);
  const added = lines.filter(l => l.type === 'add').length;
  const removed = lines.filter(l => l.type === 'remove').length;
  const summary = `+${added} -${removed}`;

  return (
    <Text dimColor>
      {truncateByWidth(summary, width).text}
    </Text>
  );
}

export function inlineDiffPreview(diff: string, maxWidth: number): string {
  const lines = diff.split('\n').filter(l => l.startsWith('+') || l.startsWith('-'));
  const preview = lines.slice(0, 3).join(' │ ');
  return truncateByWidth(preview, maxWidth).text;
}

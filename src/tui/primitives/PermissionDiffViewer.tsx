import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';
import { parseDiff } from './DiffView.js';

export interface PermissionDiffViewerProps {
  diff: string;
  width: number;
  scrollOffset?: number;
  maxLines?: number;
}

const LINE_COLORS: Record<string, string | undefined> = {
  add: TUI_THEME.success,
  remove: 'red',
  context: 'white',
  header: TUI_THEME.accent,
  hunk: TUI_THEME.warning,
  file: TUI_THEME.accent,
};

export function PermissionDiffViewer({ diff, width, scrollOffset = 0, maxLines = 20 }: PermissionDiffViewerProps) {
  const lines = parseDiff(diff);
  const visible = lines.slice(scrollOffset, scrollOffset + maxLines);
  const gutterWidth = 8;
  const contentWidth = Math.max(10, width - gutterWidth - 1);

  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderColor={TUI_THEME.muted} paddingX={1} marginTop={1}>
      <Box justifyContent="space-between">
        <Text color={TUI_THEME.accent} bold>Changes</Text>
        <Text dimColor>{lines.filter(l => l.type === 'add').length}+ {lines.filter(l => l.type === 'remove').length}-</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((line, i) => {
          const color = LINE_COLORS[line.type];
          const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
          const oldNum = line.oldLineNum !== undefined ? String(line.oldLineNum).padStart(4) : '    ';
          const newNum = line.newLineNum !== undefined ? String(line.newLineNum).padStart(4) : '    ';
          return (
            <Text key={i} color={color}>
              {oldNum} {newNum} {prefix}{truncateByWidth(line.content, contentWidth).text}
            </Text>
          );
        })}
      </Box>
      {lines.length > maxLines && (
        <Text dimColor>... {lines.length - maxLines - scrollOffset} more lines</Text>
      )}
    </Box>
  );
}

export interface PermissionDiffState {
  scrollOffset: number;
}

export function createPermissionDiffState(): PermissionDiffState {
  return { scrollOffset: 0 };
}

export function permissionDiffScrollUp(state: PermissionDiffState): PermissionDiffState {
  return { ...state, scrollOffset: Math.max(0, state.scrollOffset - 1) };
}

export function permissionDiffScrollDown(state: PermissionDiffState, _maxLines: number): PermissionDiffState {
  return { ...state, scrollOffset: state.scrollOffset + 1 };
}

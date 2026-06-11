import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header' | 'hunk';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

export function parseDiff(diffText: string): DiffLine[] {
  return diffText.split('\n').map(line => {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) {
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

export interface DiffViewProps {
  diff: string;
  width: number;
  maxLines?: number;
  showLineNumbers?: boolean;
}

const LINE_COLORS: Record<string, string | undefined> = {
  add: TUI_THEME.success,
  remove: 'red',
  context: undefined,
  header: TUI_THEME.accent,
  hunk: TUI_THEME.warning,
};

const LINE_PREFIXES: Record<string, string> = {
  add: '+',
  remove: '-',
  context: ' ',
  header: ' ',
  hunk: ' ',
};

export function DiffView({ diff, width, maxLines, showLineNumbers = false }: DiffViewProps) {
  const lines = parseDiff(diff);
  const visible = maxLines ? lines.slice(0, maxLines) : lines;
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
        <Text dimColor>{' '.repeat(gutterWidth)}... {lines.length - maxLines} more lines</Text>
      )}
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

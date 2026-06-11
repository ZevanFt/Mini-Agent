import { Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export function detectPaste(text: string): { isPaste: boolean; lineCount: number; charCount: number } {
  const lines = text.split('\n');
  return {
    isPaste: lines.length >= 3 || text.length >= 150,
    lineCount: lines.length,
    charCount: text.length,
  };
}

export function formatPasteSummary(lineCount: number, charCount: number): string {
  if (charCount > 1000) {
    return `[Pasted ~${lineCount} lines (${(charCount / 1000).toFixed(1)}k chars)]`;
  }
  return `[Pasted ~${lineCount} lines]`;
}

export interface PasteSummaryProps {
  lineCount: number;
  charCount: number;
  width: number;
}

export function PasteSummary({ lineCount, charCount, width }: PasteSummaryProps) {
  const text = formatPasteSummary(lineCount, charCount);
  return (
    <Text color={TUI_THEME.muted}>{truncateByWidth(text, width).text}</Text>
  );
}

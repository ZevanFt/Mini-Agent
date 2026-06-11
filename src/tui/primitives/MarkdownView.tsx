import { Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface MarkdownLine {
  type: 'text' | 'heading' | 'code' | 'list' | 'blockquote' | 'hr' | 'bold' | 'italic' | 'link';
  content: string;
  level?: number;
  language?: string;
}

export function parseMarkdownLine(line: string): MarkdownLine {
  const trimmed = line.trimStart();

  if (/^#{1,6}\s/.test(trimmed)) {
    const level = trimmed.match(/^(#{1,6})/)?.[1].length ?? 1;
    return { type: 'heading', content: trimmed.replace(/^#{1,6}\s/, ''), level };
  }
  if (/^```/.test(trimmed)) {
    return { type: 'code', content: '', language: trimmed.slice(3).trim() || undefined };
  }
  if (/^[-*+]\s/.test(trimmed)) {
    return { type: 'list', content: trimmed.replace(/^[-*+]\s/, '') };
  }
  if (/^\d+\.\s/.test(trimmed)) {
    return { type: 'list', content: trimmed.replace(/^\d+\.\s/, '') };
  }
  if (/^>\s/.test(trimmed)) {
    return { type: 'blockquote', content: trimmed.replace(/^>\s/, '') };
  }
  if (/^[-*_]{3,}$/.test(trimmed)) {
    return { type: 'hr', content: '' };
  }
  return { type: 'text', content: line };
}

export function parseMarkdown(text: string): MarkdownLine[] {
  return text.split('\n').map(parseMarkdownLine);
}

export interface MarkdownViewProps {
  content: string;
  width: number;
  maxLines?: number;
}

export function MarkdownView({ content, width, maxLines }: MarkdownViewProps) {
  const lines = parseMarkdown(content);
  const visible = maxLines ? lines.slice(0, maxLines) : lines;

  return (
    <>
      {visible.map((line, i) => (
        <MarkdownLineView key={i} line={line} width={width} />
      ))}
    </>
  );
}

function MarkdownLineView({ line, width }: { line: MarkdownLine; width: number }) {
  switch (line.type) {
    case 'heading':
      return (
        <Text color={TUI_THEME.accent} bold>
          {line.content}
        </Text>
      );
    case 'code':
      return (
        <Text color={TUI_THEME.muted} backgroundColor={TUI_THEME.panel}>
          {` ${line.content} `}
        </Text>
      );
    case 'list':
      return (
        <Text>
          <Text color={TUI_THEME.accent}>  • </Text>
          {line.content}
        </Text>
      );
    case 'blockquote':
      return (
        <Text dimColor>
          {`  │ ${line.content}`}
        </Text>
      );
    case 'hr':
      return (
        <Text dimColor>
          {'─'.repeat(Math.min(width, 40))}
        </Text>
      );
    case 'bold':
      return <Text bold>{line.content}</Text>;
    case 'italic':
      return <Text italic>{line.content}</Text>;
    case 'link':
      return <Text color={TUI_THEME.accent} underline>{line.content}</Text>;
    default:
      return <Text>{line.content}</Text>;
  }
}

export interface InlineMarkdownProps {
  text: string;
  width?: number;
  color?: string;
  dimColor?: boolean;
}

export function InlineMarkdown({ text, color, dimColor }: InlineMarkdownProps) {
  const processed = text
    .replace(/\*\*(.+?)\*\*/g, (_, m: string) => m)
    .replace(/\*(.+?)\*/g, (_, m: string) => m)
    .replace(/`(.+?)`/g, (_, m: string) => m);

  return (
    <Text color={color} dimColor={dimColor}>
      {processed}
    </Text>
  );
}

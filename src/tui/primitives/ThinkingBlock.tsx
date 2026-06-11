import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { wrapByWidth } from './text.js';
import { Spinner } from './Spinner.js';

export interface ThinkingBlockProps {
  content: string;
  duration?: number;
  width: number;
  collapsed?: boolean;
  isStreaming?: boolean;
}

export function ThinkingBlock({ content, duration, width, collapsed: initialCollapsed = true, isStreaming }: ThinkingBlockProps) {
  const [collapsed, _setCollapsed] = useState(initialCollapsed);
  const contentWidth = Math.max(10, width - 4);
  const durationText = duration !== undefined ? `${(duration / 1000).toFixed(1)}s` : '';
  const lineCount = wrapByWidth(content, contentWidth).length;

  return (
    <Box flexDirection="column" width={width} marginBottom={0}>
      <Box justifyContent="space-between">
        <Text color={TUI_THEME.warning}>
          {isStreaming ? <Spinner color={TUI_THEME.warning} frames="dots" /> : '💭'} Thinking
          {durationText ? ` (${durationText})` : ''}
        </Text>
        <Text
          dimColor
          color={TUI_THEME.muted}
        >
          {collapsed ? `▸ ${lineCount} lines` : '▾ collapse'}
        </Text>
      </Box>
      {!collapsed && (
        <Box marginTop={0} marginLeft={2} flexDirection="column">
          {wrapByWidth(content, contentWidth).slice(0, 20).map((line, i) => (
            <Text key={i} dimColor>{line}</Text>
          ))}
          {wrapByWidth(content, contentWidth).length > 20 && (
            <Text dimColor>  ... {wrapByWidth(content, contentWidth).length - 20} more lines</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

export interface ReasoningPart {
  type: 'thinking' | 'text';
  content: string;
  duration?: number;
}

export interface MessagePartsProps {
  parts: ReasoningPart[];
  width: number;
  isStreaming?: boolean;
}

export function MessageParts({ parts, width, isStreaming }: MessagePartsProps) {
  return (
    <Box flexDirection="column" width={width}>
      {parts.map((part, i) => {
        if (part.type === 'thinking') {
          return (
            <ThinkingBlock
              key={i}
              content={part.content}
              duration={part.duration}
              width={width}
              isStreaming={isStreaming && i === parts.length - 1}
            />
          );
        }
        return (
          <Box key={i} flexDirection="column">
            {wrapByWidth(part.content, Math.max(10, width - 2)).map((line, j) => (
              <Text key={j}>{line}</Text>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

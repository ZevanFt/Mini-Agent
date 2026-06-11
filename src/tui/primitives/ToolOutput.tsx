import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth, wrapByWidth } from './text.js';
import { Spinner } from './Spinner.js';

export type ToolCategory = 'bash' | 'file_read' | 'file_write' | 'file_edit' | 'search' | 'web' | 'task' | 'other';

export interface ToolCall {
  id: string;
  name: string;
  category: ToolCategory;
  input?: string;
  output?: string;
  error?: string;
  duration?: number;
  status: 'running' | 'completed' | 'error';
}

const CATEGORY_ICONS: Record<ToolCategory, string> = {
  bash: '⚡',
  file_read: '📖',
  file_write: '📝',
  file_edit: '✏',
  search: '🔍',
  web: '🌐',
  task: '📋',
  other: '⚙',
};

const CATEGORY_COLORS: Record<ToolCategory, string> = {
  bash: TUI_THEME.warning,
  file_read: TUI_THEME.muted,
  file_write: TUI_THEME.accent,
  file_edit: TUI_THEME.accent,
  search: TUI_THEME.muted,
  web: TUI_THEME.accent,
  task: TUI_THEME.success,
  other: TUI_THEME.muted,
};

export interface ToolOutputProps {
  tool: ToolCall;
  width: number;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function ToolOutput({ tool, width, collapsed = false, onToggle: _onToggle }: ToolOutputProps) {
  const icon = CATEGORY_ICONS[tool.category];
  const color = CATEGORY_COLORS[tool.category];
  const contentWidth = Math.max(10, width - 4);
  const statusIcon = tool.status === 'running' ? <Spinner color={color} frames="line" /> : tool.status === 'error' ? <Text color="red">✗</Text> : <Text color={TUI_THEME.success}>✓</Text>;
  const durationText = tool.duration !== undefined ? `${(tool.duration / 1000).toFixed(1)}s` : '';

  return (
    <Box flexDirection="column" width={width} marginBottom={0}>
      <Box justifyContent="space-between">
        <Text color={color}>
          {statusIcon}{' '}{icon} {tool.name}
        </Text>
        <Text dimColor>{durationText}</Text>
      </Box>
      {!collapsed && tool.input && (
        <Box marginTop={0} marginLeft={2}>
          <Text dimColor>{truncateByWidth(tool.input, contentWidth).text}</Text>
        </Box>
      )}
      {!collapsed && tool.output && (
        <Box marginTop={0} marginLeft={2} flexDirection="column">
          {wrapByWidth(tool.output, contentWidth).slice(0, 6).map((line, i) => (
            <Text key={i} dimColor>{line}</Text>
          ))}
          {wrapByWidth(tool.output, contentWidth).length > 6 && (
            <Text dimColor>  ... {wrapByWidth(tool.output, contentWidth).length - 6} more lines</Text>
          )}
        </Box>
      )}
      {!collapsed && tool.error && (
        <Box marginTop={0} marginLeft={2}>
          <Text color="red">{truncateByWidth(tool.error, contentWidth).text}</Text>
        </Box>
      )}
    </Box>
  );
}

export interface ToolOutputListProps {
  tools: ToolCall[];
  width: number;
  maxVisible?: number;
}

export function ToolOutputList({ tools, width, maxVisible = 3 }: ToolOutputListProps) {
  const [collapsed, _setCollapsed] = useState(true);
  const visible = collapsed ? tools.slice(-maxVisible) : tools;

  if (tools.length === 0) return null;

  return (
    <Box flexDirection="column" width={width}>
      {tools.length > maxVisible && collapsed && (
        <Box marginLeft={2}>
          <Text dimColor>
            {tools.length - maxVisible} more tools (press to expand)
          </Text>
        </Box>
      )}
      {visible.map(tool => (
        <ToolOutput key={tool.id} tool={tool} width={width} collapsed={collapsed} />
      ))}
    </Box>
  );
}

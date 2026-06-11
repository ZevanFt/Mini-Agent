import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface ToolOutputExpandProps {
  toolName: string;
  output: string;
  isExpanded: boolean;
  maxLines: number;
  width: number;
  onToggle: () => void;
}

export function ToolOutputExpand({ toolName: _toolName, output, isExpanded, maxLines, width, onToggle: _onToggle }: ToolOutputExpandProps) {
  const lines = output.split('\n');
  const shouldCollapse = lines.length > maxLines;
  const displayLines = isExpanded ? lines : lines.slice(0, maxLines);

  return (
    <Box flexDirection="column" width={width}>
      {displayLines.map((line, i) => (
        <Text key={i}>{truncateByWidth(line, width - 2).text}</Text>
      ))}
      {shouldCollapse && (
        <Text color={TUI_THEME.accent} dimColor={!isExpanded}>
          {isExpanded ? '▼ collapse' : `▶ expand (${lines.length - maxLines} more lines)`}
        </Text>
      )}
    </Box>
  );
}

export interface ToolOutputExpandState {
  expandedTools: Set<string>;
}

export function createToolOutputExpandState(): ToolOutputExpandState {
  return { expandedTools: new Set() };
}

export function toggleToolOutput(state: ToolOutputExpandState, toolId: string): ToolOutputExpandState {
  const expanded = new Set(state.expandedTools);
  if (expanded.has(toolId)) {
    expanded.delete(toolId);
  } else {
    expanded.add(toolId);
  }
  return { ...state, expandedTools: expanded };
}

export function isToolExpanded(state: ToolOutputExpandState, toolId: string): boolean {
  return state.expandedTools.has(toolId);
}

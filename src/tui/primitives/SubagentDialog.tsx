import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface SubagentDialogProps {
  subagents: { sessionId: string; label: string; status: string }[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function SubagentDialog({ subagents, selectedIndex, termWidth, termHeight }: SubagentDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const maxVisible = Math.max(4, termHeight - 8);

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Subagents</Text>
          <Text dimColor>{subagents.length} active</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {subagents.slice(0, maxVisible).map((sa, i) => {
            const isSelected = i === selectedIndex;
            const statusColor = sa.status === 'running' ? TUI_THEME.warning : sa.status === 'completed' ? TUI_THEME.success : 'red';
            return (
              <Box key={sa.sessionId} justifyContent="space-between">
                <Text color={isSelected ? TUI_THEME.accent : TUI_THEME.muted} bold={isSelected}>
                  {isSelected ? '▸ ' : '  '}{sa.label}
                </Text>
                <Text color={statusColor}>{sa.status}</Text>
              </Box>
            );
          })}
          {subagents.length === 0 && <Text dimColor>No subagents</Text>}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter open session</Text>
          <Text dimColor>Esc close</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface SubagentDialogState {
  isOpen: boolean;
  selectedIndex: number;
  subagents: { sessionId: string; label: string; status: string }[];
}

export function createSubagentDialogState(): SubagentDialogState {
  return { isOpen: false, selectedIndex: 0, subagents: [] };
}

export function openSubagentDialog(state: SubagentDialogState, subagents: { sessionId: string; label: string; status: string }[]): SubagentDialogState {
  return { ...state, isOpen: true, subagents, selectedIndex: 0 };
}

export function closeSubagentDialog(state: SubagentDialogState): SubagentDialogState {
  return { ...state, isOpen: false };
}

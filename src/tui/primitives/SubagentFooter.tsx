import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface SubagentInfo {
  sessionId: string;
  label: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  contextPercent?: number;
  cost?: number;
}

export interface SubagentFooterProps {
  current: SubagentInfo;
  siblings: SubagentInfo[];
  currentIndex: number;
  termWidth: number;
}

export function SubagentFooter({ current, siblings, currentIndex, termWidth }: SubagentFooterProps) {
  const width = Math.min(termWidth - 4, termWidth);

  return (
    <Box width={width} justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color={TUI_THEME.accent} bold>{current.agentName}</Text>
        {siblings.length > 1 && (
          <Text dimColor> ({currentIndex + 1} of {siblings.length})</Text>
        )}
      </Box>
      <Box>
        {current.contextPercent !== undefined && (
          <Text dimColor>{current.contextPercent}% ctx</Text>
        )}
        {current.cost !== undefined && current.cost > 0 && (
          <Text dimColor> ${current.cost.toFixed(2)}</Text>
        )}
        <Text dimColor> [</Text>
        <Text color={current.status === 'running' ? TUI_THEME.warning : current.status === 'completed' ? TUI_THEME.success : 'red'}>
          {current.status === 'running' ? '●' : current.status === 'completed' ? '✓' : '✗'}
        </Text>
        <Text dimColor>]</Text>
      </Box>
    </Box>
  );
}

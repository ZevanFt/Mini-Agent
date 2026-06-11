import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface WorkspaceLabelProps {
  name: string;
  type: string;
  connected: boolean;
  termWidth: number;
}

export function WorkspaceLabel({ name, type, connected, termWidth }: WorkspaceLabelProps) {
  const width = Math.min(termWidth - 4, termWidth);

  return (
    <Box width={width} justifyContent="space-between" paddingX={1}>
      <Box>
        <Text color={TUI_THEME.accent} bold>{name}</Text>
        <Text dimColor> ({type})</Text>
      </Box>
      <Text color={connected ? TUI_THEME.success : 'red'}>{connected ? '●' : '○'}</Text>
    </Box>
  );
}

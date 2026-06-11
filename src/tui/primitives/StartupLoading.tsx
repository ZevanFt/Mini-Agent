import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface StartupLoadingProps {
  phase: 'plugins' | 'startup' | 'done';
  termWidth: number;
}

export function StartupLoading({ phase, termWidth }: StartupLoadingProps) {
  if (phase === 'done') return null;

  const width = Math.min(termWidth - 8, 48);
  const message = phase === 'plugins' ? 'Loading plugins...' : 'Finishing startup...';

  return (
    <Box flexDirection="column" width={termWidth} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.muted} paddingX={1} paddingY={1} justifyContent="center" alignItems="center">
        <Text color={TUI_THEME.accent}>●●●</Text>
        <Box marginTop={1}>
          <Text dimColor>{message}</Text>
        </Box>
      </Box>
    </Box>
  );
}

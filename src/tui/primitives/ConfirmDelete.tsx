import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface ConfirmDeleteProps {
  title: string;
  message: string;
  confirmLabel?: string;
  termWidth: number;
}

export function ConfirmDelete({ title, message, confirmLabel = 'Delete', termWidth }: ConfirmDeleteProps) {
  const width = Math.min(termWidth - 8, 64);

  return (
    <Box flexDirection="column" width={termWidth} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor="red" paddingX={1} paddingY={1}>
        <Text color="red" bold>⚠ {title}</Text>
        <Box marginTop={1}>
          <Text>{truncateByWidth(message, width - 6).text}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={TUI_THEME.muted}>▸ Press D again to confirm</Text>
          <Text color={TUI_THEME.muted}>  Press any other key to cancel</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>{confirmLabel} requires double-press</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface ConfirmDeleteState {
  isOpen: boolean;
  title: string;
  message: string;
  pendingKey: boolean;
}

export function createConfirmDeleteState(): ConfirmDeleteState {
  return { isOpen: false, title: '', message: '', pendingKey: false };
}

export function showConfirmDelete(state: ConfirmDeleteState, title: string, message: string): ConfirmDeleteState {
  return { ...state, isOpen: true, title, message, pendingKey: true };
}

export function closeConfirmDelete(state: ConfirmDeleteState): ConfirmDeleteState {
  return { ...state, isOpen: false, pendingKey: false };
}

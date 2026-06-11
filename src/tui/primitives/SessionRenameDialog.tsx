import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface SessionRenameDialogProps {
  currentTitle: string;
  termWidth: number;
  termHeight: number;
}

export function SessionRenameDialog({ currentTitle, termWidth, termHeight: _termHeight }: SessionRenameDialogProps) {
  const [value, _setValue] = useState(currentTitle);
  const width = Math.min(termWidth - 8, 60);
  const contentWidth = width - 6;

  return (
    <Box flexDirection="column" width={termWidth} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.accent} bold>Rename Session</Text>
        <Box marginTop={1}>
          <Text dimColor>Current: </Text>
          <Text>{truncateByWidth(currentTitle, contentWidth - 10).text}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={TUI_THEME.accent}>▸ </Text>
          <Text>{value || 'Type new name...'}</Text>
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>Enter confirm</Text>
          <Text dimColor>Esc cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface SessionRenameState {
  isOpen: boolean;
  value: string;
}

export function createSessionRenameState(): SessionRenameState {
  return { isOpen: false, value: '' };
}

export function openSessionRename(state: SessionRenameState, currentTitle: string): SessionRenameState {
  return { ...state, isOpen: true, value: currentTitle };
}

export function closeSessionRename(state: SessionRenameState): SessionRenameState {
  return { ...state, isOpen: false, value: '' };
}

export function sessionRenameType(state: SessionRenameState, char: string): SessionRenameState {
  return { ...state, value: state.value + char };
}

export function sessionRenameBackspace(state: SessionRenameState): SessionRenameState {
  return { ...state, value: state.value.slice(0, -1) };
}

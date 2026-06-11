import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface SessionMoveDialogProps {
  currentPath: string;
  destinations: { path: string; name: string }[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function SessionMoveDialog({ currentPath, destinations, selectedIndex, termWidth, termHeight }: SessionMoveDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 4;
  const maxVisible = Math.max(4, termHeight - 8);

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.warning} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.warning} bold>Move Session</Text>
          <Text dimColor>From: {truncateByWidth(currentPath, 20).text}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {destinations.slice(0, maxVisible).map((dest, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Text
                key={dest.path}
                color={isSelected ? TUI_THEME.accent : undefined}
                bold={isSelected}
              >{isSelected ? '▸ ' : '  '}{truncateByWidth(dest.name, contentWidth - 4).text}</Text>
            );
          })}
          {destinations.length === 0 && <Text dimColor>No destinations available</Text>}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter move</Text>
          <Text dimColor>Esc cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface SessionMoveState {
  isOpen: boolean;
  selectedIndex: number;
}

export function createSessionMoveState(): SessionMoveState {
  return { isOpen: false, selectedIndex: 0 };
}

export function openSessionMove(state: SessionMoveState): SessionMoveState {
  return { ...state, isOpen: true, selectedIndex: 0 };
}

export function closeSessionMove(state: SessionMoveState): SessionMoveState {
  return { ...state, isOpen: false };
}

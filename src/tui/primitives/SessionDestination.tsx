import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface DestinationEntry {
  path: string;
  name: string;
  isCurrent: boolean;
}

export interface SessionDestinationPickerProps {
  destinations: DestinationEntry[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function SessionDestinationPicker({ destinations, selectedIndex, termWidth, termHeight }: SessionDestinationPickerProps) {
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 4;
  const maxVisible = Math.max(4, termHeight - 8);

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Session Destination</Text>
          <Text dimColor>{destinations.length} directories</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {destinations.slice(0, maxVisible).map((dest, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={dest.path} justifyContent="space-between">
                <Text
                  color={isSelected ? TUI_THEME.accent : dest.isCurrent ? TUI_THEME.success : undefined}
                  bold={isSelected}
                >{isSelected ? '▸ ' : '  '}{dest.isCurrent ? '● ' : '○ '}{truncateByWidth(dest.name, contentWidth - 16).text}</Text>
                <Text dimColor>{truncateByWidth(dest.path, 14).text}</Text>
              </Box>
            );
          })}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter select</Text>
          <Text dimColor>Esc cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface SessionDestinationState {
  isOpen: boolean;
  selectedIndex: number;
  destinations: DestinationEntry[];
}

export function createSessionDestinationState(): SessionDestinationState {
  return { isOpen: false, selectedIndex: 0, destinations: [] };
}

export function openSessionDestination(state: SessionDestinationState, destinations: DestinationEntry[]): SessionDestinationState {
  return { ...state, isOpen: true, destinations, selectedIndex: 0 };
}

export function closeSessionDestination(state: SessionDestinationState): SessionDestinationState {
  return { ...state, isOpen: false };
}

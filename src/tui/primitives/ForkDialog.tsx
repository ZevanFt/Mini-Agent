import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface ForkDialogProps {
  messages: { role: string; content: string; type?: string }[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function ForkDialog({ messages, selectedIndex, termWidth, termHeight }: ForkDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 6;
  const maxVisible = Math.max(4, termHeight - 8);
  const userMessages = messages.filter(m => m.role === 'user');

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Fork Session From</Text>
          <Text dimColor>{userMessages.length} messages</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {userMessages.slice(0, maxVisible).map((msg, i) => {
            const isSelected = i === selectedIndex;
            const preview = msg.content.split('\n')[0];
            return (
              <Box key={i} justifyContent="space-between">
                <Text color={isSelected ? TUI_THEME.accent : undefined} bold={isSelected}>
                  {isSelected ? '▸ ' : '  '}{truncateByWidth(preview, contentWidth - 8).text}
                </Text>
              </Box>
            );
          })}
          {userMessages.length === 0 && <Text dimColor>No messages to fork from</Text>}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter fork</Text>
          <Text dimColor>Esc cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface ForkState {
  isOpen: boolean;
  selectedIndex: number;
}

export function createForkState(): ForkState {
  return { isOpen: false, selectedIndex: 0 };
}

export function openFork(state: ForkState): ForkState {
  return { ...state, isOpen: true, selectedIndex: 0 };
}

export function closeFork(state: ForkState): ForkState {
  return { ...state, isOpen: false };
}

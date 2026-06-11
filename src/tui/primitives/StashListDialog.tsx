import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface StashEntry {
  id: string;
  text: string;
  timestamp: number;
  lineCount: number;
}

export interface StashListDialogProps {
  entries: StashEntry[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function StashListDialog({ entries, selectedIndex, termWidth, termHeight }: StashListDialogProps) {
  const width = Math.min(termWidth - 8, 68);
  const contentWidth = width - 6;
  const maxVisible = Math.max(4, termHeight - 8);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.warning} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.warning} bold>Stashed Prompts</Text>
          <Text dimColor>{entries.length} stashed</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {entries.length === 0 && <Text dimColor>No stashed prompts</Text>}
          {entries.slice(0, maxVisible).map((entry, i) => {
            const isSelected = i === selectedIndex;
            const firstLine = entry.text.split('\n')[0];
            return (
              <Box key={entry.id} flexDirection="column">
                <Box justifyContent="space-between">
                  <Text
                    color={isSelected ? TUI_THEME.warning : undefined}
                    bold={isSelected}
                  >{isSelected ? '▸ ' : '  '}{truncateByWidth(firstLine, contentWidth - 16).text}</Text>
                  <Text dimColor>{formatTime(entry.timestamp)}</Text>
                </Box>
                {isSelected && (
                  <Text dimColor>  {entry.lineCount} lines · Enter load · d delete</Text>
                )}
              </Box>
            );
          })}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter restore</Text>
          <Text dimColor>d delete</Text>
          <Text dimColor>Esc close</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface StashListState {
  isOpen: boolean;
  selectedIndex: number;
}

export function createStashListState(): StashListState {
  return { isOpen: false, selectedIndex: 0 };
}

export function openStashList(state: StashListState): StashListState {
  return { ...state, isOpen: true, selectedIndex: 0 };
}

export function closeStashList(state: StashListState): StashListState {
  return { ...state, isOpen: false };
}

export function stashListUp(state: StashListState): StashListState {
  return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };
}

export function stashListDown(state: StashListState, total: number): StashListState {
  return { ...state, selectedIndex: Math.min(total - 1, state.selectedIndex + 1) };
}

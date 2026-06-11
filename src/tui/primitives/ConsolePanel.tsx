import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface ConsoleEntry {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
}

export interface ConsolePanelProps {
  entries: ConsoleEntry[];
  termWidth: number;
  termHeight: number;
}

export function ConsolePanel({ entries, termWidth, termHeight }: ConsolePanelProps) {
  const width = Math.min(termWidth - 4, termWidth);
  const contentWidth = width - 4;
  const maxVisible = Math.max(4, termHeight - 6);
  const visible = entries.slice(-maxVisible);

  const levelColors: Record<string, string> = {
    log: TUI_THEME.muted,
    warn: TUI_THEME.warning,
    error: 'red',
    info: TUI_THEME.accent,
  };

  return (
    <Box flexDirection="column" width={width} height={termHeight - 1} borderStyle="single" borderColor={TUI_THEME.muted} paddingX={1}>
      <Box justifyContent="space-between">
        <Text color={TUI_THEME.muted} bold>Console</Text>
        <Text dimColor>{entries.length} entries</Text>
      </Box>
      <Box marginTop={1} flexDirection="column" height={termHeight - 4}>
        {visible.length === 0 && <Text dimColor>No console output</Text>}
        {visible.map((entry, i) => (
          <Box key={i}>
            <Text dimColor>{new Date(entry.timestamp).toLocaleTimeString()} </Text>
            <Text color={levelColors[entry.level]}>[{entry.level.toUpperCase()}] </Text>
            <Text>{truncateByWidth(entry.message, contentWidth - 20).text}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>↑↓ scroll</Text>
        <Text dimColor>Ctrl+` toggle</Text>
        <Text dimColor>Esc close</Text>
      </Box>
    </Box>
  );
}

export interface ConsoleState {
  isOpen: boolean;
  entries: ConsoleEntry[];
  scrollOffset: number;
}

export function createConsoleState(): ConsoleState {
  return { isOpen: false, entries: [], scrollOffset: 0 };
}

export function toggleConsole(state: ConsoleState): ConsoleState {
  return { ...state, isOpen: !state.isOpen };
}

export function addConsoleEntry(state: ConsoleState, level: ConsoleEntry['level'], message: string): ConsoleState {
  return {
    ...state,
    entries: [...state.entries, { timestamp: Date.now(), level, message }].slice(-500),
  };
}

export function clearConsole(state: ConsoleState): ConsoleState {
  return { ...state, entries: [] };
}

import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface RetryActionProps {
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  showDontShowAgain?: boolean;
  termWidth: number;
}

export function RetryAction({ title, message, actionLabel = 'Retry', actionUrl: _actionUrl, showDontShowAgain = true, termWidth }: RetryActionProps) {
  const [selectedIndex, _setSelectedIndex] = useState(0);
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 6;

  return (
    <Box flexDirection="column" width={termWidth} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.warning} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.warning} bold>⚠ {title}</Text>
        <Box marginTop={1}>
          <Text>{truncateByWidth(message, contentWidth).text}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text
            color={selectedIndex === 0 ? TUI_THEME.accent : TUI_THEME.muted}
            bold={selectedIndex === 0}
          >{selectedIndex === 0 ? '▸ ' : '  '}{actionLabel}</Text>
          {showDontShowAgain && (
            <Text
              color={selectedIndex === 1 ? TUI_THEME.accent : TUI_THEME.muted}
              bold={selectedIndex === 1}
            >{selectedIndex === 1 ? '▸ ' : '  '}Don't show again</Text>
          )}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter confirm</Text>
          <Text dimColor>Esc dismiss</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface RetryActionState {
  isOpen: boolean;
  title: string;
  message: string;
  actionLabel: string;
  showDontShowAgain: boolean;
  selectedIndex: number;
}

export function createRetryActionState(): RetryActionState {
  return { isOpen: false, title: '', message: '', actionLabel: 'Retry', showDontShowAgain: true, selectedIndex: 0 };
}

export function showRetryAction(state: RetryActionState, title: string, message: string, actionLabel = 'Retry'): RetryActionState {
  return { ...state, isOpen: true, title, message, actionLabel, selectedIndex: 0 };
}

export function closeRetryAction(state: RetryActionState): RetryActionState {
  return { ...state, isOpen: false };
}

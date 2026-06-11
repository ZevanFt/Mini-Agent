import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface MessageAction {
  label: string;
  key: string;
  description: string;
}

export interface MessageDialogProps {
  messageIndex: number;
  messagePreview: string;
  actions?: MessageAction[];
  selectedIndex: number;
  termWidth: number;
}

const DEFAULT_ACTIONS: MessageAction[] = [
  { label: 'Copy', key: 'c', description: 'Copy message to clipboard' },
  { label: 'Revert', key: 'r', description: 'Revert to this message' },
  { label: 'Fork', key: 'f', description: 'Fork session from here' },
];

export function MessageDialog({ messageIndex, messagePreview, actions = DEFAULT_ACTIONS, selectedIndex, termWidth }: MessageDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 6;

  return (
    <Box flexDirection="column" width={termWidth} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.accent} bold>Message #{messageIndex + 1}</Text>
        <Box marginTop={1}>
          <Text dimColor>{truncateByWidth(messagePreview, contentWidth).text}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {actions.map((action, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Text key={action.key} color={isSelected ? TUI_THEME.accent : TUI_THEME.muted} bold={isSelected}>
                {isSelected ? '▸ ' : '  '}{action.label} — {action.description}
              </Text>
            );
          })}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter confirm</Text>
          <Text dimColor>Esc cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface MessageDialogState {
  isOpen: boolean;
  messageIndex: number;
  messagePreview: string;
  selectedIndex: number;
}

export function createMessageDialogState(): MessageDialogState {
  return { isOpen: false, messageIndex: 0, messagePreview: '', selectedIndex: 0 };
}

export function openMessageDialog(state: MessageDialogState, messageIndex: number, preview: string): MessageDialogState {
  return { ...state, isOpen: true, messageIndex, messagePreview: preview, selectedIndex: 0 };
}

export function closeMessageDialog(state: MessageDialogState): MessageDialogState {
  return { ...state, isOpen: false };
}

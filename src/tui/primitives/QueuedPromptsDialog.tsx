import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface QueuedPrompt {
  id: string;
  text: string;
  timestamp: number;
}

export interface QueuedPromptsDialogProps {
  prompts: QueuedPrompt[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function QueuedPromptsDialog({ prompts, selectedIndex, termWidth, termHeight }: QueuedPromptsDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 6;
  const maxVisible = Math.max(4, termHeight - 8);

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.warning} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.warning} bold>Queued Prompts</Text>
          <Text dimColor>{prompts.length} queued</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {prompts.slice(0, maxVisible).map((prompt, i) => {
            const isSelected = i === selectedIndex;
            const preview = prompt.text.split('\n')[0];
            return (
              <Box key={prompt.id} justifyContent="space-between">
                <Text color={isSelected ? TUI_THEME.accent : undefined} bold={isSelected}>
                  {isSelected ? '▸ ' : '  '}{preview.slice(0, contentWidth - 8)}
                </Text>
              </Box>
            );
          })}
          {prompts.length === 0 && <Text dimColor>No queued prompts</Text>}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter send</Text>
          <Text dimColor>Ctrl+D remove</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface QueuedPromptsState {
  isOpen: boolean;
  selectedIndex: number;
}

export function createQueuedPromptsState(): QueuedPromptsState {
  return { isOpen: false, selectedIndex: 0 };
}

export function openQueuedPrompts(state: QueuedPromptsState): QueuedPromptsState {
  return { ...state, isOpen: true, selectedIndex: 0 };
}

export function closeQueuedPrompts(state: QueuedPromptsState): QueuedPromptsState {
  return { ...state, isOpen: false };
}

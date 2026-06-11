import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface HelpDialogProps {
  termWidth: number;
  termHeight: number;
}

const HELP_SECTIONS = [
  {
    title: 'Navigation',
    items: [
      ['Ctrl+P', 'Command palette'],
      ['F1', 'Keyboard shortcuts'],
      ['Tab / Shift+Tab', 'Cycle agents'],
      ['F2 / Shift+F2', 'Cycle recent models'],
      ['Ctrl+T', 'Cycle model variants'],
    ],
  },
  {
    title: 'Session',
    items: [
      ['Ctrl+N', 'New session'],
      ['Ctrl+O', 'Session list'],
      ['Ctrl+S', 'Save session'],
      ['Ctrl+R', 'Rename session'],
      ['Ctrl+Shift+Z', 'Dialog size'],
    ],
  },
  {
    title: 'Display',
    items: [
      ['Ctrl+Shift+T', 'Toggle timestamps'],
      ['Ctrl+Shift+H', 'Toggle thinking'],
      ['Ctrl+Shift+D', 'Toggle tool details'],
      ['Ctrl+Shift+S', 'Toggle sidebar'],
      ['Ctrl+Shift+B', 'Toggle todo panel'],
      ['Ctrl+Shift+G', 'Toggle modified files'],
      ['Ctrl+Shift+X', 'Cycle theme'],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['Ctrl+E', 'Export options'],
      ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / Redo'],
      ['Ctrl+Shift+C', 'Copy transcript'],
      ['Ctrl+Shift+J', 'Open editor'],
      ['Ctrl+`', 'Console'],
      ['@', 'File autocomplete'],
    ],
  },
];

export function HelpDialog({ termWidth, termHeight }: HelpDialogProps) {
  const width = Math.min(termWidth - 8, 68);
  const maxVisible = Math.max(4, termHeight - 6);

  let lineCount = 0;

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.accent} bold>Help — MiniAgent TUI</Text>
        <Box marginTop={1} flexDirection="column">
          {HELP_SECTIONS.map(section => {
            if (lineCount >= maxVisible) return null;
            lineCount++;
            return (
              <Box key={section.title} flexDirection="column">
                <Text color={TUI_THEME.warning} bold>{section.title}</Text>
                {section.items.map(([key, desc]) => {
                  if (lineCount >= maxVisible) return null;
                  lineCount++;
                  return (
                    <Box key={key} justifyContent="space-between">
                      <Text color={TUI_THEME.accent}>{key}</Text>
                      <Text dimColor>{desc}</Text>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>Ctrl+P command palette</Text>
          <Text dimColor>Esc close</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface HelpState {
  isOpen: boolean;
}

export function createHelpState(): HelpState {
  return { isOpen: false };
}

export function openHelp(state: HelpState): HelpState {
  return { ...state, isOpen: true };
}

export function closeHelp(state: HelpState): HelpState {
  return { ...state, isOpen: false };
}

import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface ThemeListDialogProps {
  themes: { name: string; isDark: boolean; isActive: boolean }[];
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

export function ThemeListDialog({ themes, selectedIndex, termWidth, termHeight }: ThemeListDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const maxVisible = Math.max(4, termHeight - 8);

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Themes</Text>
          <Text dimColor>{themes.length} themes</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {themes.slice(0, maxVisible).map((theme, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={theme.name} justifyContent="space-between">
                <Text color={isSelected ? TUI_THEME.accent : theme.isActive ? TUI_THEME.success : undefined} bold={isSelected || theme.isActive}>
                  {isSelected ? '▸ ' : '  '}{theme.name}
                </Text>
                <Text dimColor>{theme.isDark ? 'dark' : 'light'}</Text>
              </Box>
            );
          })}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter select</Text>
          <Text dimColor>Esc close</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface ThemeListState {
  isOpen: boolean;
  selectedIndex: number;
  themes: { name: string; isDark: boolean; isActive: boolean }[];
}

export function createThemeListState(): ThemeListState {
  return { isOpen: false, selectedIndex: 0, themes: [] };
}

export function openThemeList(state: ThemeListState, themes: { name: string; isDark: boolean; isActive: boolean }[]): ThemeListState {
  const activeIdx = themes.findIndex(t => t.isActive);
  return { ...state, isOpen: true, themes, selectedIndex: activeIdx >= 0 ? activeIdx : 0 };
}

export function closeThemeList(state: ThemeListState): ThemeListState {
  return { ...state, isOpen: false };
}

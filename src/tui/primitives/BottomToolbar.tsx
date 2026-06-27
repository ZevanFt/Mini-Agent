import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface ToolbarItem {
  icon: string;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

export interface BottomToolbarProps {
  width: number;
  items?: ToolbarItem[];
}

const DEFAULT_ITEMS: ToolbarItem[] = [
  { icon: '⚙', label: '设置', shortcut: 'Ctrl+P' },
  { icon: '📁', label: '文件', shortcut: '@' },
  { icon: '🤖', label: '模式', shortcut: 'Tab' },
  { icon: '💬', label: '清空', shortcut: 'Ctrl+Shift+D' },
  { icon: '📤', label: '导出', shortcut: 'Ctrl+Shift+E' },
];

export function BottomToolbar({ width, items = DEFAULT_ITEMS }: BottomToolbarProps) {
  const itemWidth = Math.floor(width / items.length);
  const remainder = width % items.length;

  return (
    <Box width={width} justifyContent="space-between">
      {items.map((item, i) => {
        const w = itemWidth + (i < remainder ? 1 : 0);
        const text = `${item.icon} ${item.label}`;
        const padding = Math.max(0, w - text.length - (item.shortcut?.length || 0) - 1);
        return (
          <Box key={i} width={w}>
            <Text color={TUI_THEME.accent}>{item.icon}</Text>
            <Text> {item.label}</Text>
            {item.shortcut && (
              <Text dimColor>{' '.repeat(padding)}{item.shortcut}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

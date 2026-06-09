import { Box, Text } from 'ink';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { fillByWidth, getStringWidth, truncateByWidth } from './text.js';

export type CommandRow<T> =
  | { type: 'header'; category: string }
  | { type: 'command'; command: T; index: number; category: string };

export interface RenderCommandRowsOptions<T extends { name: string; description?: string }> {
  rows: CommandRow<T>[];
  width: number;
  activeIndex: number;
  keyPrefix: string;
}

export function renderCommandRows<T extends { name: string; description?: string }>({
  rows,
  width,
  activeIndex,
  keyPrefix,
}: RenderCommandRowsOptions<T>) {
  return rows.map((row, i) => {
    if (row.type === 'header') {
      return (
        <Text key={`${keyPrefix}-header-${row.category}-${i}`} color={TUI_THEME.warning}>
          {fillByWidth(i === 0 ? row.category : ` ${row.category}`, width)}
        </Text>
      );
    }

    const cmd = row.command;
    const selected = row.index === activeIndex;
    const label = `${selected ? TUI_GLYPHS.selected : ' '} /${cmd.name}`;
    const suffix = `[${row.category}]`;
    const descriptionWidth = Math.max(0, width - getStringWidth(label) - getStringWidth(suffix) - 4);
    const description = truncateByWidth(cmd.description || '', descriptionWidth).text;
    const line = description ? `${label}  ${description}` : label;

    return (
      <Box key={`${keyPrefix}-${cmd.name}`} width={width} justifyContent="space-between">
        <Text
          color={selected ? 'white' : TUI_THEME.accent}
          backgroundColor={selected ? TUI_THEME.selected : undefined}
        >
          {fillByWidth(line, width - getStringWidth(suffix))}
        </Text>
        <Text
          dimColor={!selected}
          color={selected ? TUI_THEME.warning : undefined}
          backgroundColor={selected ? TUI_THEME.selected : undefined}
        >
          {suffix}
        </Text>
      </Box>
    );
  });
}

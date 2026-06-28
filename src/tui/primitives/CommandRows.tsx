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
      <Box key={`${keyPrefix}-${cmd.name}`} width={width} flexDirection="column">
        <Text backgroundColor={selected ? TUI_THEME.accent : TUI_THEME.inputBg}>
          {'  '}{fillByWidth(line, width - getStringWidth(suffix) - 2)}
          <Text color={selected ? 'white' : TUI_THEME.muted}>{suffix}</Text>
        </Text>
      </Box>
    );
  });
}

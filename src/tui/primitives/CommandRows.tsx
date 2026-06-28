import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { fillByWidth, getStringWidth, truncateByWidth } from './text.js';

export type CommandRow<T> =
  | { type: 'header'; category: string }
  | { type: 'command'; command: T; index: number; category: string };

export interface RenderCommandRowsOptions<T extends { name: string; description?: string }> {
  rows: CommandRow<T>[];
  width: number;
  activeIndex: number;
  keyPrefix: string;
  /** 左侧 padding 字符数（内容前填充空格，背景色延伸到 padding 区域） */
  leftPadding?: number;
}

export function renderCommandRows<T extends { name: string; description?: string }>({
  rows,
  width,
  activeIndex,
  keyPrefix,
  leftPadding = 0,
}: RenderCommandRowsOptions<T>) {
  const pad = ' '.repeat(leftPadding);
  // 内容可用宽度 = 总宽 - 左 padding
  const contentWidth = Math.max(1, width - leftPadding);
  return rows.map((row, i) => {
    if (row.type === 'header') {
      return null;
    }

    const cmd = row.command;
    const selected = row.index === activeIndex;
    const name = `/${cmd.name}`;
    const description = truncateByWidth(cmd.description || '', Math.max(10, contentWidth - getStringWidth(name) - 4)).text;
    const line = description ? `${name}  ${description}` : name;
    // 加左 padding，fillByWidth 填充到总宽度（右侧自动补空格，背景色延伸）
    const paddedLine = pad + line;

    return (
      <Box key={`${keyPrefix}-${cmd.name}-${i}`} width={width}>
        {selected ? (
          <Text backgroundColor={TUI_THEME.selected} color="white">
            {fillByWidth(paddedLine, width)}
          </Text>
        ) : (
          <Text backgroundColor={TUI_THEME.inputBg}>
            {fillByWidth(paddedLine, width)}
          </Text>
        )}
      </Box>
    );
  });
}

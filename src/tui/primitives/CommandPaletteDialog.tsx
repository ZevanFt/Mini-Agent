import { Box, Text } from 'ink';
import { DialogFrame, DialogHeader } from './DialogFrame.js';
import { renderCommandRows, type CommandRow } from './CommandRows.js';
import { TUI_THEME } from './theme.js';
import { fillByWidth, truncateByWidth } from './text.js';

export interface CommandPaletteDialogProps {
  width: number;
  contentWidth: number;
  termWidth: number;
  termHeight: number;
  filter: string;
  totalCount: number;
  scrollHint: string;
  activeIndex: number;
  rows: CommandRow<{ name: string; description?: string }>[];
  selectedName: string;
  selectedUsage: string;
  selectedCategory: string;
  selectedDescription: string;
}

export function CommandPaletteDialog({
  width,
  contentWidth,
  termWidth,
  termHeight,
  filter,
  totalCount,
  scrollHint,
  activeIndex,
  rows,
  selectedName,
  selectedUsage,
  selectedCategory,
  selectedDescription,
}: CommandPaletteDialogProps) {
  return (
    <DialogFrame termWidth={termWidth} termHeight={termHeight} width={width}>
      <DialogHeader
        title="Command Palette"
        meta={totalCount > 0 ? `${scrollHint} ${activeIndex + 1}/${totalCount}` : '0 commands'}
      />
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Search</Text>
        <Text backgroundColor={TUI_THEME.panel}>{fillByWidth(` ${filter || 'type command name...'}`, contentWidth)}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {totalCount === 0 && (
          <Text dimColor>{fillByWidth('No commands found', contentWidth)}</Text>
        )}
        {renderCommandRows({ rows, width: contentWidth, activeIndex, keyPrefix: 'modal-command' })}
      </Box>
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>↑↓ move</Text>
        <Text dimColor>{totalCount === 0 ? 'Backspace edit   Esc close' : 'Enter select   Esc close'}</Text>
      </Box>
      {selectedName && (
        <Box marginTop={1} flexDirection="column">
          <Text color={TUI_THEME.warning}>{fillByWidth(`[${selectedCategory}] ${selectedUsage}`, contentWidth)}</Text>
          <Text dimColor>{fillByWidth(truncateByWidth(selectedDescription, contentWidth).text, contentWidth)}</Text>
        </Box>
      )}
    </DialogFrame>
  );
}

import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { fillByWidth, getStringWidth, truncateByWidth } from './text.js';
import { NoticeText, type NoticeState } from './Notice.js';

export interface FooterProps {
  cwd: string;
  version: string;
  termWidth: number;
  notice: NoticeState | null;
  isPaletteOpen: boolean;
  hasConversation: boolean;
}

export function Footer({ cwd, version, termWidth, notice, isPaletteOpen, hasConversation }: FooterProps) {
  const paletteHint = '↑↓ move  Enter select  Esc close';
  const statusText = '• 0 LSP  /status';

  const rightText = notice?.message
    || (isPaletteOpen ? paletteHint : hasConversation ? statusText : version);
  const rightWidth = getStringWidth(rightText);
  const leftWidth = Math.max(10, termWidth - rightWidth - 2);

  return (
    <Box width={termWidth} height={1}>
      <Text dimColor>{fillByWidth(isPaletteOpen ? 'Palette' : `${cwd}:main`, leftWidth)}</Text>
      {notice ? (
        <NoticeText notice={notice} width={rightWidth} />
      ) : isPaletteOpen ? (
        <Text dimColor>{truncateByWidth(rightText, rightWidth).text}</Text>
      ) : hasConversation ? (
        <>
          <Text color={TUI_THEME.success}>•</Text>
          <Text dimColor>{truncateByWidth(' 0 LSP  /status', Math.max(0, termWidth - leftWidth - 1)).text}</Text>
        </>
      ) : (
        <Text dimColor>{truncateByWidth(version, rightWidth).text}</Text>
      )}
    </Box>
  );
}

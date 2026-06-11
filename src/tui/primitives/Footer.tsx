import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { fillByWidth, getStringWidth, truncateByWidth } from './text.js';
import { NoticeText, type NoticeState } from './Notice.js';

export interface FooterStatus {
  lspCount: number;
  mcpCount: number;
  mcpErrors: number;
  permCount: number;
  isConnected: boolean;
}

export interface FooterProps {
  cwd: string;
  version: string;
  termWidth: number;
  notice: NoticeState | null;
  isPaletteOpen: boolean;
  hasConversation: boolean;
  isProcessing?: boolean;
  status?: FooterStatus;
}

export function Footer({
  cwd,
  version,
  termWidth,
  notice,
  isPaletteOpen,
  hasConversation,
  isProcessing: _isProcessing = false,
  status = { lspCount: 0, mcpCount: 0, mcpErrors: 0, permCount: 0, isConnected: true },
}: FooterProps) {
  const paletteHint = '↑↓ move  Enter select  Esc close';

  const statusParts: string[] = [];
  if (status.permCount > 0) statusParts.push(`⚠ ${status.permCount} perm`);
  statusParts.push(`${status.lspCount} LSP`);
  statusParts.push(`${status.mcpCount} MCP`);
  const statusText = statusParts.join('  ');

  const rightText = notice?.message
    || (isPaletteOpen ? paletteHint : hasConversation ? statusText : `PgUp/PgDn scroll  Ctrl+Shift+C copy  ${version}`);
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
          <Text color={status.permCount > 0 ? TUI_THEME.warning : TUI_THEME.success}>
            {status.permCount > 0 ? '⚠' : '•'}
          </Text>
          <Text dimColor>
            {truncateByWidth(
              ` ${status.lspCount} LSP  ${status.mcpCount} MCP${status.mcpErrors > 0 ? ` (${status.mcpErrors} err)` : ''}`,
              Math.max(0, termWidth - leftWidth - 1),
            ).text}
          </Text>
        </>
      ) : (
        <Text dimColor>{truncateByWidth(version, rightWidth).text}</Text>
      )}
    </Box>
  );
}

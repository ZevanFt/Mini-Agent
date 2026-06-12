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

  // Build the complete footer text first, then truncate to fit
  const leftContent = isPaletteOpen ? 'Palette' : `${cwd}:main`;
  const separator = '  ';
  const rightContent = truncateByWidth(rightText, termWidth - 15).text; // reserve 15 for left minimum

  // Calculate exact widths
  const leftWidth = getStringWidth(leftContent);
  const rightWidth = getStringWidth(rightContent);
  const separatorWidth = getStringWidth(separator);

  // If total exceeds termWidth, truncate left
  const totalNeeded = leftWidth + separatorWidth + rightWidth;
  const truncatedLeft = totalNeeded > termWidth
    ? truncateByWidth(leftContent, Math.max(0, termWidth - separatorWidth - rightWidth)).text
    : leftContent;

  // Build final strings
  const finalLeft = fillByWidth(truncatedLeft, Math.min(termWidth - 1, getStringWidth(truncatedLeft)));
  const remainingWidth = termWidth - getStringWidth(finalLeft);

  return (
    <Box width={termWidth} height={1}>
      <Text dimColor>{finalLeft}</Text>
      {notice ? (
        <NoticeText notice={notice} width={Math.min(remainingWidth, rightWidth)} />
      ) : isPaletteOpen ? (
        <Text dimColor>{truncateByWidth(rightText, remainingWidth).text}</Text>
      ) : hasConversation ? (
        <>
          <Text color={status.permCount > 0 ? TUI_THEME.warning : TUI_THEME.success}>
            {status.permCount > 0 ? '⚠' : '•'}
          </Text>
          <Text dimColor> {truncateByWidth(rightText, Math.max(0, remainingWidth - 1)).text}</Text>
        </>
      ) : (
        <Text color={TUI_THEME.muted}>Get started — type a message or /help</Text>
      )}
    </Box>
  );
}

import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface CompactionMarkerProps {
  width: number;
  title?: string;
  reason?: 'auto' | 'manual';
}

export function CompactionMarker({ width, title, reason = 'auto' }: CompactionMarkerProps) {
  const displayTitle = title || (reason === 'auto' ? ' Auto Compaction ' : ' Compaction ');
  const lineWidth = Math.floor((width - displayTitle.length - 2) / 2);
  const left = '─'.repeat(Math.max(0, lineWidth));
  const right = '─'.repeat(Math.max(0, width - lineWidth - displayTitle.length - 2));

  return (
    <Box width={width} justifyContent="center" alignItems="center" marginTop={1} marginBottom={1}>
      <Text color={TUI_THEME.muted}>{left}</Text>
      <Text color={reason === 'auto' ? TUI_THEME.warning : TUI_THEME.accent} bold>{displayTitle}</Text>
      <Text color={TUI_THEME.muted}>{right}</Text>
    </Box>
  );
}

export interface RevertInfoPanelProps {
  messageCount: number;
  affectedFiles: { path: string; added: number; removed: number }[];
  width: number;
}

export function RevertInfoPanel({ messageCount, affectedFiles, width }: RevertInfoPanelProps) {
  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderColor={TUI_THEME.warning} paddingX={1} marginTop={1} marginBottom={1}>
      <Box justifyContent="space-between">
        <Text color={TUI_THEME.warning} bold>Reverted</Text>
        <Text dimColor>{messageCount} messages reverted</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+Shift+Z to redo</Text>
      </Box>
      {affectedFiles.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Affected files:</Text>
          {affectedFiles.slice(0, 5).map((f, i) => (
            <Box key={i}>
              <Text dimColor>  {f.path} </Text>
              <Text color={TUI_THEME.success}>+{f.added}</Text>
              <Text color="red"> -{f.removed}</Text>
            </Box>
          ))}
          {affectedFiles.length > 5 && (
            <Text dimColor>  ... {affectedFiles.length - 5} more files</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

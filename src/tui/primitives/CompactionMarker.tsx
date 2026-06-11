import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface CompactionMarkerProps {
  width: number;
  title?: string;
}

export function CompactionMarker({ width, title = 'Compaction' }: CompactionMarkerProps) {
  const lineWidth = Math.floor((width - title.length - 4) / 2);
  const left = '─'.repeat(lineWidth);
  const right = '─'.repeat(width - lineWidth - title.length - 4);

  return (
    <Box width={width} justifyContent="center" alignItems="center" marginTop={1} marginBottom={1}>
      <Text color={TUI_THEME.muted}>{left}</Text>
      <Text color={TUI_THEME.accent}>{` ${title} `}</Text>
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

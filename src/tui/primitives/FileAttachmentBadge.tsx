import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface FileAttachment {
  name: string;
  path: string;
  size?: number;
  type?: string;
}

export interface FileAttachmentBadgeProps {
  attachments: FileAttachment[];
  width: number;
}

export function FileAttachmentBadge({ attachments, width }: FileAttachmentBadgeProps) {
  if (attachments.length === 0) return null;

  return (
    <Box flexDirection="column" width={width} marginTop={1}>
      <Text color={TUI_THEME.accent} bold>Attachments:</Text>
      {attachments.map((file, i) => (
        <Box key={i}>
          <Text color={TUI_THEME.accent}>📎 </Text>
          <Text>{truncateByWidth(file.name, width - 8).text}</Text>
          {file.size !== undefined && (
            <Text dimColor> ({formatFileSize(file.size)})</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

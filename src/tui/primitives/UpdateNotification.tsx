import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  releaseNotes?: string;
}

export interface UpdateNotificationProps {
  info: UpdateInfo;
  termWidth: number;
}

export function UpdateNotification({ info, termWidth }: UpdateNotificationProps) {
  const [selectedIndex, _setSelectedIndex] = useState(0);
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 6;

  return (
    <Box flexDirection="column" width={termWidth} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.success} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.success} bold>Update Available</Text>
        <Box marginTop={1}>
          <Text>Current: {info.currentVersion}</Text>
        </Box>
        <Box>
          <Text color={TUI_THEME.success}>Latest: {info.latestVersion}</Text>
        </Box>
        {info.releaseNotes && (
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>Release notes:</Text>
            <Text>{truncateByWidth(info.releaseNotes, contentWidth).text}</Text>
          </Box>
        )}
        <Box marginTop={1} flexDirection="column">
          <Text
            color={selectedIndex === 0 ? TUI_THEME.accent : TUI_THEME.muted}
            bold={selectedIndex === 0}
          >{selectedIndex === 0 ? '▸ ' : '  '}Update now</Text>
          <Text
            color={selectedIndex === 1 ? TUI_THEME.accent : TUI_THEME.muted}
            bold={selectedIndex === 1}
          >{selectedIndex === 1 ? '▸ ' : '  '}Skip this version</Text>
          <Text
            color={selectedIndex === 2 ? TUI_THEME.accent : TUI_THEME.muted}
            bold={selectedIndex === 2}
          >{selectedIndex === 2 ? '▸ ' : '  '}Dismiss</Text>
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Enter confirm</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface UpdateState {
  isOpen: boolean;
  info: UpdateInfo | null;
  selectedIndex: number;
}

export function createUpdateState(): UpdateState {
  return { isOpen: false, info: null, selectedIndex: 0 };
}

export function showUpdate(state: UpdateState, info: UpdateInfo): UpdateState {
  return { ...state, isOpen: true, info, selectedIndex: 0 };
}

export function closeUpdate(state: UpdateState): UpdateState {
  return { ...state, isOpen: false };
}

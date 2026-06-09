import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { TUI_THEME } from './theme.js';

export interface DialogFrameProps {
  termWidth: number;
  termHeight: number;
  width: number;
  borderColor?: string;
  children: ReactNode;
}

export function DialogFrame({
  termWidth,
  termHeight,
  width,
  borderColor = TUI_THEME.accent,
  children,
}: DialogFrameProps) {
  return (
    <Box width={termWidth} height={termHeight - 1} alignItems="center" justifyContent="center">
      <Box
        flexDirection="column"
        width={Math.min(termWidth - 8, width)}
        borderStyle="round"
        borderColor={borderColor}
        paddingX={2}
        paddingY={1}
      >
        {children}
      </Box>
    </Box>
  );
}

export function DialogHeader({ title, meta, color = TUI_THEME.accent }: { title: string; meta?: string; color?: string }) {
  return (
    <Box justifyContent="space-between">
      <Text color={color} bold>{title}</Text>
      {meta && <Text dimColor>{meta}</Text>}
    </Box>
  );
}

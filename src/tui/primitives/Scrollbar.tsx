import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface ScrollbarProps {
  totalItems: number;
  visibleItems: number;
  scrollOffset: number;
  height: number;
}

export function Scrollbar({ totalItems, visibleItems, scrollOffset, height }: ScrollbarProps) {
  if (totalItems <= visibleItems) return null;

  const thumbHeight = Math.max(1, Math.floor((visibleItems / totalItems) * height));
  const thumbPos = Math.floor((scrollOffset / Math.max(1, totalItems - visibleItems)) * (height - thumbHeight));

  return (
    <Box flexDirection="column" width={1} height={height}>
      {Array.from({ length: height }).map((_, i) => (
        <Text key={i} color={i >= thumbPos && i < thumbPos + thumbHeight ? TUI_THEME.accent : TUI_THEME.muted}>
          {i >= thumbPos && i < thumbPos + thumbHeight ? '█' : '░'}
        </Text>
      ))}
    </Box>
  );
}

import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { fillByWidth } from './text.js';

export interface ViewportProps {
  items: React.ReactNode[];
  height: number;
  width: number;
  activeIndex?: number;
  showScrollbar?: boolean;
  scrollbarChar?: string;
  emptyText?: string;
}

export function Viewport({
  items,
  height,
  width,
  activeIndex,
  showScrollbar = true,
  scrollbarChar = '▪',
}: ViewportProps) {
  const safeHeight = Math.max(1, height);
  const scrollbarWidth = showScrollbar && items.length > safeHeight ? 2 : 0;
  const contentWidth = Math.max(1, width - scrollbarWidth);

  let startIndex = 0;
  if (items.length > safeHeight && activeIndex !== undefined) {
    startIndex = Math.max(0, Math.min(activeIndex - safeHeight + 1, items.length - safeHeight));
  }
  const visibleItems = items.slice(startIndex, startIndex + safeHeight);
  const hasMoreAbove = startIndex > 0;
  const hasMoreBelow = startIndex + visibleItems.length < items.length;

  const scrollPosition = items.length <= safeHeight
    ? 0
    : Math.floor(((activeIndex ?? 0) / Math.max(1, items.length - 1)) * (safeHeight - 1));
  const thumbHeight = Math.max(1, Math.floor((safeHeight / Math.max(1, items.length)) * safeHeight));

  return (
    <Box width={width} flexDirection="row">
      <Box flexDirection="column" width={contentWidth} height={safeHeight}>
        {hasMoreAbove && (
          <Text dimColor>{fillByWidth('▲', contentWidth)}</Text>
        )}
        {visibleItems.map((item, i) => (
          <Box key={`vp-${startIndex + i}`} width={contentWidth}>
            {item}
          </Box>
        ))}
        {hasMoreBelow && (
          <Text dimColor>{fillByWidth('▼', contentWidth)}</Text>
        )}
      </Box>
      {showScrollbar && scrollbarWidth > 0 && (
        <Box flexDirection="column" width={scrollbarWidth}>
          {Array.from({ length: safeHeight }).map((_, i) => {
            const isThumb = i >= scrollPosition && i < scrollPosition + thumbHeight;
            return (
              <Text
                key={`sb-${i}`}
                color={isThumb ? TUI_THEME.accent : TUI_THEME.muted}
                dimColor={!isThumb}
              >{isThumb ? scrollbarChar : ' '}</Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export interface UseViewportOptions {
  itemCount: number;
  viewportHeight: number;
  activeIndex: number;
}

export interface UseViewportResult {
  startIndex: number;
  endIndex: number;
  hasMoreAbove: boolean;
  hasMoreBelow: boolean;
  scrollOffset: number;
}

export function useViewport({ itemCount, viewportHeight, activeIndex }: UseViewportOptions): UseViewportResult {
  const safeHeight = Math.max(1, viewportHeight);
  const safeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, itemCount - 1)));
  const startIndex = Math.max(0, Math.min(safeIndex - safeHeight + 1, Math.max(0, itemCount - safeHeight)));
  const endIndex = Math.min(itemCount, startIndex + safeHeight);
  return {
    startIndex,
    endIndex,
    hasMoreAbove: startIndex > 0,
    hasMoreBelow: endIndex < itemCount,
    scrollOffset: startIndex,
  };
}

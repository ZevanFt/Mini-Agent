export interface ScrollWindowResult<T> {
  start: number;
  end: number;
  items: T[];
  hasMoreAbove: boolean;
  hasMoreBelow: boolean;
}

export function getScrollWindow<T>(items: T[], activeIndex: number, size: number): ScrollWindowResult<T> {
  const safeSize = Math.max(1, size);
  const safeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, items.length - 1)));
  const start = Math.max(0, Math.min(safeIndex - safeSize + 1, Math.max(0, items.length - safeSize)));
  const end = Math.min(items.length, start + safeSize);
  return {
    start,
    end,
    items: items.slice(start, end),
    hasMoreAbove: start > 0,
    hasMoreBelow: end < items.length,
  };
}

export function scrollHint(hasMoreAbove: boolean, hasMoreBelow: boolean): string {
  return `${hasMoreAbove ? '↑' : ' '} ${hasMoreBelow ? '↓' : ' '}`;
}

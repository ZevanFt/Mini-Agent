export interface ScrollState {
  scrollTop: number;
  viewportHeight: number;
  totalItems: number;
}

export function createScrollState(viewportHeight: number, totalItems = 0): ScrollState {
  return { scrollTop: 0, viewportHeight, totalItems };
}

export function scrollUp(state: ScrollState, lines = 1): ScrollState {
  return { ...state, scrollTop: Math.max(0, state.scrollTop - lines) };
}

export function scrollDown(state: ScrollState, lines = 1): ScrollState {
  const maxScroll = Math.max(0, state.totalItems - state.viewportHeight);
  return { ...state, scrollTop: Math.min(maxScroll, state.scrollTop + lines) };
}

export function scrollHalfPageUp(state: ScrollState): ScrollState {
  return scrollUp(state, Math.max(1, Math.floor(state.viewportHeight / 2)));
}

export function scrollHalfPageDown(state: ScrollState): ScrollState {
  return scrollDown(state, Math.max(1, Math.floor(state.viewportHeight / 2)));
}

export function scrollQuarterPageUp(state: ScrollState): ScrollState {
  return scrollUp(state, Math.max(1, Math.floor(state.viewportHeight / 4)));
}

export function scrollQuarterPageDown(state: ScrollState): ScrollState {
  return scrollDown(state, Math.max(1, Math.floor(state.viewportHeight / 4)));
}

export function scrollToTop(state: ScrollState): ScrollState {
  return { ...state, scrollTop: 0 };
}

export function scrollToBottom(state: ScrollState): ScrollState {
  return { ...state, scrollTop: Math.max(0, state.totalItems - state.viewportHeight) };
}

export function scrollPageUp(state: ScrollState): ScrollState {
  return scrollUp(state, state.viewportHeight);
}

export function scrollPageDown(state: ScrollState): ScrollState {
  return scrollDown(state, state.viewportHeight);
}

export function scrollStickyBottom(state: ScrollState, autoStick = true): ScrollState {
  if (!autoStick) return state;
  const maxScroll = Math.max(0, state.totalItems - state.viewportHeight);
  const isAtBottom = state.scrollTop >= maxScroll - 2;
  return isAtBottom ? { ...state, scrollTop: maxScroll } : state;
}

export function updateTotalItems(state: ScrollState, total: number): ScrollState {
  const maxScroll = Math.max(0, total - state.viewportHeight);
  return {
    ...state,
    totalItems: total,
    scrollTop: Math.min(state.scrollTop, maxScroll),
  };
}

export function isAtBottom(state: ScrollState): boolean {
  return state.scrollTop >= state.totalItems - state.viewportHeight - 1;
}

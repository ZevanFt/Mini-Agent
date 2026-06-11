export interface SessionToggles {
  timestamps: boolean;
  showThinking: boolean;
  showToolDetails: boolean;
  showScrollbar: boolean;
  concealCode: boolean;
  sidebarVisible: boolean;
}

export function createSessionToggles(): SessionToggles {
  return {
    timestamps: false,
    showThinking: true,
    showToolDetails: true,
    showScrollbar: false,
    concealCode: false,
    sidebarVisible: true,
  };
}

export function toggleTimestamps(state: SessionToggles): SessionToggles {
  return { ...state, timestamps: !state.timestamps };
}

export function toggleThinking(state: SessionToggles): SessionToggles {
  return { ...state, showThinking: !state.showThinking };
}

export function toggleToolDetails(state: SessionToggles): SessionToggles {
  return { ...state, showToolDetails: !state.showToolDetails };
}

export function toggleScrollbar(state: SessionToggles): SessionToggles {
  return { ...state, showScrollbar: !state.showScrollbar };
}

export function toggleConcealCode(state: SessionToggles): SessionToggles {
  return { ...state, concealCode: !state.concealCode };
}

export function toggleSidebar(state: SessionToggles): SessionToggles {
  return { ...state, sidebarVisible: !state.sidebarVisible };
}

export type SessionToggleKey = keyof SessionToggles;

export function toggleByKey(state: SessionToggles, key: SessionToggleKey): SessionToggles {
  return { ...state, [key]: !state[key] };
}

export function getToggleLabel(key: SessionToggleKey, state: SessionToggles): string {
  const labels: Record<SessionToggleKey, string> = {
    timestamps: 'Timestamps',
    showThinking: 'Thinking',
    showToolDetails: 'Tool details',
    showScrollbar: 'Scrollbar',
    concealCode: 'Code conceal',
    sidebarVisible: 'Sidebar',
  };
  return `${labels[key]}: ${state[key] ? 'on' : 'off'}`;
}

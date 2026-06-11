export const TUI_THEME = {
  accent: '#0078d7',
  success: '#00cc66',
  warning: '#ffcc00',
  error: '#ff4444',
  muted: '#666666',
  panel: '#1a1a2e',
  logo: '#0078d7',
  selected: '#264f78',
};

export const TUI_GLYPHS = {
  bullet: '●',
  diamond: '◆',
  arrow: '→',
  check: '✓',
  cross: '✗',
  divider: '─',
  ellipsis: '…',
  lock: '🔒',
  unlock: '🔓',
  selected: '▸',
};

export type TUITheme = typeof TUI_THEME;

// ==================== Theme System ====================

export interface ThemeColors {
  name: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  muted: string;
  panel: string;
  logo: string;
  diffAdd: string;
  diffRemove: string;
  diffHeader: string;
}

export const THEMES: Record<string, ThemeColors> = {
  default: {
    name: 'default', accent: '#0078d7', success: '#00cc66', warning: '#ffcc00',
    error: '#ff4444', muted: '#666666', panel: '#1a1a2e', logo: '#0078d7',
    diffAdd: '#00cc66', diffRemove: '#ff4444', diffHeader: '#0078d7',
  },
  monokai: {
    name: 'monokai', accent: '#f92672', success: '#a6e22e', warning: '#e6db74',
    error: '#f92672', muted: '#75715e', panel: '#272822', logo: '#f92672',
    diffAdd: '#a6e22e', diffRemove: '#f92672', diffHeader: '#66d9ef',
  },
  solarized: {
    name: 'solarized', accent: '#268bd2', success: '#859900', warning: '#b58900',
    error: '#dc322f', muted: '#586e75', panel: '#002b36', logo: '#268bd2',
    diffAdd: '#859900', diffRemove: '#dc322f', diffHeader: '#268bd2',
  },
  dracula: {
    name: 'dracula', accent: '#bd93f9', success: '#50fa7b', warning: '#f1fa8c',
    error: '#ff5555', muted: '#6272a4', panel: '#282a36', logo: '#bd93f9',
    diffAdd: '#50fa7b', diffRemove: '#ff5555', diffHeader: '#bd93f9',
  },
  nord: {
    name: 'nord', accent: '#88c0d0', success: '#a3be8c', warning: '#ebcb8b',
    error: '#bf616a', muted: '#4c566a', panel: '#2e3440', logo: '#88c0d0',
    diffAdd: '#a3be8c', diffRemove: '#bf616a', diffHeader: '#88c0d0',
  },
  gruvbox: {
    name: 'gruvbox', accent: '#fabd2f', success: '#b8bb26', warning: '#fabd2f',
    error: '#fb4934', muted: '#928374', panel: '#282828', logo: '#fabd2f',
    diffAdd: '#b8bb26', diffRemove: '#fb4934', diffHeader: '#fabd2f',
  },
  catppuccin: {
    name: 'catppuccin', accent: '#89b4fa', success: '#a6e3a1', warning: '#f9e2af',
    error: '#f38ba8', muted: '#6c7086', panel: '#1e1e2e', logo: '#89b4fa',
    diffAdd: '#a6e3a1', diffRemove: '#f38ba8', diffHeader: '#89b4fa',
  },
};

export type ThemeName = keyof typeof THEMES;

export function getThemeColors(name: ThemeName): ThemeColors {
  return THEMES[name] || THEMES.default;
}

export function getThemeNames(): ThemeName[] {
  return Object.keys(THEMES) as ThemeName[];
}

export function cycleTheme(current: ThemeName): ThemeName {
  const names = getThemeNames();
  const idx = names.indexOf(current);
  return names[(idx + 1) % names.length];
}

export interface ThemeState {
  current: ThemeName;
  mode: 'dark' | 'light';
  locked: boolean;
}

export function createThemeState(): ThemeState {
  return { current: 'default', mode: 'dark', locked: false };
}

export function nextTheme(state: ThemeState): ThemeState {
  return { ...state, current: cycleTheme(state.current) };
}

export function toggleThemeMode(state: ThemeState): ThemeState {
  if (state.locked) return state;
  return { ...state, mode: state.mode === 'dark' ? 'light' : 'dark' };
}

export function lockTheme(state: ThemeState): ThemeState {
  return { ...state, locked: !state.locked };
}

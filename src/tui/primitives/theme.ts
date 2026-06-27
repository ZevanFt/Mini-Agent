export const TUI_THEME = {
  accent: '#0078d7',
  success: '#00cc66',
  warning: '#ffcc00',
  error: '#ff4444',
  muted: '#666666',
  panel: '#141414',
  inputBg: '#1e1e1e',
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
  catppuccinFrappe: {
    name: 'catppuccinFrappe', accent: '#8caaee', success: '#a6d189', warning: '#e5c890',
    error: '#e78284', muted: '#838ba7', panel: '#303446', logo: '#8caaee',
    diffAdd: '#a6d189', diffRemove: '#e78284', diffHeader: '#8caaee',
  },
  catppuccinMacchiato: {
    name: 'catppuccinMacchiato', accent: '#8aadf4', success: '#a6da95', warning: '#eed49f',
    error: '#ed8796', muted: '#6e738d', panel: '#24273a', logo: '#8aadf4',
    diffAdd: '#a6da95', diffRemove: '#ed8796', diffHeader: '#8aadf4',
  },
  tokyonight: {
    name: 'tokyonight', accent: '#7aa2f7', success: '#9ece6a', warning: '#e0af68',
    error: '#f7768e', muted: '#565f89', panel: '#1a1b26', logo: '#7aa2f7',
    diffAdd: '#9ece6a', diffRemove: '#f7768e', diffHeader: '#7aa2f7',
  },
  rosepine: {
    name: 'rosepine', accent: '#c4a7e7', success: '#31748f', warning: '#f6c177',
    error: '#eb6f92', muted: '#6e6a86', panel: '#191724', logo: '#c4a7e7',
    diffAdd: '#31748f', diffRemove: '#eb6f92', diffHeader: '#c4a7e7',
  },
  github: {
    name: 'github', accent: '#0969da', success: '#1a7f37', warning: '#9a6700',
    error: '#cf222e', muted: '#656d76', panel: '#0d1117', logo: '#0969da',
    diffAdd: '#1a7f37', diffRemove: '#cf222e', diffHeader: '#0969da',
  },
  oneDark: {
    name: 'oneDark', accent: '#61afef', success: '#98c379', warning: '#e5c07b',
    error: '#e06c75', muted: '#5c6370', panel: '#282c34', logo: '#61afef',
    diffAdd: '#98c379', diffRemove: '#e06c75', diffHeader: '#61afef',
  },
  kanagawa: {
    name: 'kanagawa', accent: '#7e9cd8', success: '#98bb6c', warning: '#e6c384',
    error: '#c34043', muted: '#6a6577', panel: '#1f1f28', logo: '#7e9cd8',
    diffAdd: '#98bb6c', diffRemove: '#c34043', diffHeader: '#7e9cd8',
  },
  everforest: {
    name: 'everforest', accent: '#7fbbb3', success: '#a7c080', warning: '#dbbc7f',
    error: '#e67e80', muted: '#7a8478', panel: '#2d353b', logo: '#7fbbb3',
    diffAdd: '#a7c080', diffRemove: '#e67e80', diffHeader: '#7fbbb3',
  },
  flexoki: {
    name: 'flexoki', accent: '#3584e4', success: '#2e9f54', warning: '#df8e1d',
    error: '#e02424', muted: '#878580', panel: '#100f0f', logo: '#3584e4',
    diffAdd: '#2e9f54', diffRemove: '#e02424', diffHeader: '#3584e4',
  },
  carbonfox: {
    name: 'carbonfox', accent: '#78dce8', success: '#25be6a', warning: '#04d1f7',
    error: '#ee5396', muted: '#8b8fa3', panel: '#161616', logo: '#78dce8',
    diffAdd: '#25be6a', diffRemove: '#ee5396', diffHeader: '#78dce8',
  },
  matrix: {
    name: 'matrix', accent: '#00ff41', success: '#00ff41', warning: '#ffff00',
    error: '#ff0000', muted: '#008f11', panel: '#0a0a0a', logo: '#00ff41',
    diffAdd: '#00ff41', diffRemove: '#ff0000', diffHeader: '#00ff41',
  },
  cobalt2: {
    name: 'cobalt2', accent: '#ffc600', success: '#7fdbca', warning: '#ffcc00',
    error: '#ff628c', muted: '#6272a4', panel: '#132738', logo: '#ffc600',
    diffAdd: '#7fdbca', diffRemove: '#ff628c', diffHeader: '#ffc600',
  },
  nightowl: {
    name: 'nightowl', accent: '#82aaff', success: '#7fdbca', warning: '#ffcc00',
    error: '#ff7eb6', muted: '#637777', panel: '#011627', logo: '#82aaff',
    diffAdd: '#7fdbca', diffRemove: '#ff7eb6', diffHeader: '#82aaff',
  },
  synthwave84: {
    name: 'synthwave84', accent: '#fede5d', success: '#36f9f6', warning: '#fede5d',
    error: '#fe4450', muted: '#848bbd', panel: '#241b30', logo: '#fede5d',
    diffAdd: '#36f9f6', diffRemove: '#fe4450', diffHeader: '#fede5d',
  },
  palenight: {
    name: 'palenight', accent: '#c792ea', success: '#c3e88d', warning: '#ffcb6b',
    error: '#ff5370', muted: '#676e95', panel: '#292d3e', logo: '#c792ea',
    diffAdd: '#c3e88d', diffRemove: '#ff5370', diffHeader: '#c792ea',
  },
  material: {
    name: 'material', accent: '#82aaff', success: '#c3e88d', warning: '#ffcb6b',
    error: '#ff5370', muted: '#676e95', panel: '#23272e', logo: '#82aaff',
    diffAdd: '#c3e88d', diffRemove: '#ff5370', diffHeader: '#82aaff',
  },
  ayu: {
    name: 'ayu', accent: '#39bae6', success: '#7fd962', warning: '#ffb454',
    error: '#d95757', muted: '#626a73', panel: '#0d1017', logo: '#39bae6',
    diffAdd: '#7fd962', diffRemove: '#d95757', diffHeader: '#39bae6',
  },
  zenburn: {
    name: 'zenburn', accent: '#dcdccc', success: '#7f9f7f', warning: '#dca3a3',
    error: '#cc9393', muted: '#9f9f8f', panel: '#3f3f3f', logo: '#dcdccc',
    diffAdd: '#7f9f7f', diffRemove: '#cc9393', diffHeader: '#dcdccc',
  },
  vesper: {
    name: 'vesper', accent: '#d4d4d4', success: '#00cc66', warning: '#ffcc00',
    error: '#ff4444', muted: '#666666', panel: '#1a1a1a', logo: '#d4d4d4',
    diffAdd: '#00cc66', diffRemove: '#ff4444', diffHeader: '#d4d4d4',
  },
  vercel: {
    name: 'vercel', accent: '#0070f3', success: '#00cc66', warning: '#f5a623',
    error: '#ee0000', muted: '#666666', panel: '#000000', logo: '#0070f3',
    diffAdd: '#00cc66', diffRemove: '#ee0000', diffHeader: '#0070f3',
  },
  cursor: {
    name: 'cursor', accent: '#7c3aed', success: '#10b981', warning: '#f59e0b',
    error: '#ef4444', muted: '#6b7280', panel: '#1e1e2e', logo: '#7c3aed',
    diffAdd: '#10b981', diffRemove: '#ef4444', diffHeader: '#7c3aed',
  },
  opencode: {
    name: 'opencode', accent: '#0078d7', success: '#00cc66', warning: '#ffcc00',
    error: '#ff4444', muted: '#666666', panel: '#0a0a0a', logo: '#0078d7',
    diffAdd: '#00cc66', diffRemove: '#ff4444', diffHeader: '#0078d7',
  },
  orng: {
    name: 'orng', accent: '#ff8c00', success: '#00cc66', warning: '#ffcc00',
    error: '#ff4444', muted: '#666666', panel: '#1a1a1a', logo: '#ff8c00',
    diffAdd: '#00cc66', diffRemove: '#ff4444', diffHeader: '#ff8c00',
  },
  lucentOrng: {
    name: 'lucentOrng', accent: '#ff8c00', success: '#00cc66', warning: '#ffcc00',
    error: '#ff4444', muted: '#888888', panel: '#0f0f0f', logo: '#ff8c00',
    diffAdd: '#00cc66', diffRemove: '#ff4444', diffHeader: '#ff8c00',
  },
  aura: {
    name: 'aura', accent: '#bb9af7', success: '#9ece6a', warning: '#e0af68',
    error: '#f7768e', muted: '#565f89', panel: '#151520', logo: '#bb9af7',
    diffAdd: '#9ece6a', diffRemove: '#f7768e', diffHeader: '#bb9af7',
  },
  mercury: {
    name: 'mercury', accent: '#88c0d0', success: '#a3be8c', warning: '#ebcb8b',
    error: '#bf616a', muted: '#4c566a', panel: '#1a1a2e', logo: '#88c0d0',
    diffAdd: '#a3be8c', diffRemove: '#bf616a', diffHeader: '#88c0d0',
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

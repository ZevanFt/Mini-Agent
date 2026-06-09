export const TUI_THEME = {
  accent: 'cyan',
  muted: 'gray',
  panel: '#141414',
  selected: '#1f1f1f',
  logo: '#0078d7',
  success: 'green',
  warning: 'yellow',
} as const;

export const TUI_GLYPHS = {
  selected: '›',
  divider: '─',
  bullet: '·',
} as const;

export type TuiTheme = typeof TUI_THEME;
export type TuiGlyphs = typeof TUI_GLYPHS;

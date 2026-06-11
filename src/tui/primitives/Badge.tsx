import { Text } from 'ink';
import { TUI_THEME } from './theme.js';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'accent';

const BADGE_COLORS: Record<BadgeVariant, { fg: string; bg: string }> = {
  default: { fg: 'white', bg: TUI_THEME.panel },
  success: { fg: 'black', bg: TUI_THEME.success },
  warning: { fg: 'black', bg: TUI_THEME.warning },
  error: { fg: 'white', bg: 'red' },
  info: { fg: 'white', bg: TUI_THEME.accent },
  accent: { fg: 'white', bg: TUI_THEME.accent },
};

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dimmed?: boolean;
}

export function Badge({ label, variant = 'default', dimmed }: BadgeProps) {
  const colors = BADGE_COLORS[variant];
  return (
    <Text
      color={colors.fg}
      backgroundColor={colors.bg}
      bold={variant !== 'default'}
      dimColor={dimmed}
    >{` ${label} `}</Text>
  );
}

export interface StatusDotProps {
  status: 'active' | 'inactive' | 'error' | 'pending';
}

const DOT_COLORS: Record<string, string> = {
  active: TUI_THEME.success,
  inactive: TUI_THEME.muted,
  error: 'red',
  pending: TUI_THEME.warning,
};

export function StatusDot({ status }: StatusDotProps) {
  return <Text color={DOT_COLORS[status] ?? TUI_THEME.muted}>●</Text>;
}

export interface TagProps {
  label: string;
  color?: string;
}

export function Tag({ label, color }: TagProps) {
  return (
    <Text color={color ?? TUI_THEME.muted} dimColor>
      {`[${label}]`}
    </Text>
  );
}

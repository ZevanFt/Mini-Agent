import { Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export type NoticeLevel = 'info' | 'success' | 'warning' | 'error';

export interface NoticeState {
  message: string;
  level: NoticeLevel;
}

export function NoticeText({ notice, width }: { notice: NoticeState; width: number }) {
  const color = notice.level === 'success'
    ? TUI_THEME.success
    : notice.level === 'warning'
      ? TUI_THEME.warning
      : notice.level === 'error'
        ? 'red'
        : TUI_THEME.accent;
  return <Text color={color}>{truncateByWidth(notice.message, width).text}</Text>;
}

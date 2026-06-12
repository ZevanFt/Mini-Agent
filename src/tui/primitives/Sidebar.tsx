import { Box, Text } from 'ink';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { fillByWidth } from './text.js';

export interface SidebarRow {
  text: string;
  bold?: boolean;
  color?: string;
  dim?: boolean;
}

export interface SidebarProps {
  rows: SidebarRow[];
  footerRows: SidebarRow[];
  width: number;
  paddingX?: number;
  fillHeight?: number;
}

export function Sidebar({ rows, footerRows, width, paddingX = 2, fillHeight = 0 }: SidebarProps) {
  const innerWidth = Math.max(12, width - paddingX * 2 - 1);
  const line = (text = '') => fillByWidth(text, innerWidth);

  return (
    <Box width={width} flexDirection="column" paddingX={paddingX} paddingY={1}>
      {rows.map((row, i) => (
        <Text
          key={`sidebar-row-${i}`}
          bold={row.bold}
          color={row.color}
          dimColor={row.dim}
          backgroundColor={TUI_THEME.panel}
        >{row.text}</Text>
      ))}
      {Array.from({ length: fillHeight }).map((_, i) => (
        <Text key={`sidebar-fill-${i}`} backgroundColor={TUI_THEME.panel}>{line()}</Text>
      ))}
      {footerRows.map((row, i) => (
        <Text
          key={`sidebar-footer-${i}`}
          color={row.color}
          dimColor={row.dim}
          backgroundColor={TUI_THEME.panel}
        >{row.text}</Text>
      ))}
    </Box>
  );
}

export function buildSidebarRows(opts: {
  messages: number;
  modelName: string;
  currentMode: string;
  tokensUsed: number;
  tokenPercent: number;
  totalCost: string;
  promptStash: string | null;
  lastUserPrompt: string | undefined;
  lastExportPath: string | null;
  lastCopyStatus: 'idle' | 'copied' | 'fallback';
  lastForkIndex: number | null;
  forkUndoMessages: unknown;
  sidebarInnerWidth: number;
  sessionTitle?: string;
  timestamps?: boolean;
  showThinking?: boolean;
  showToolDetails?: boolean;
  modifiedFiles?: { path: string; added: number; removed: number }[];
  todos?: { text: string; status: 'done' | 'in_progress' | 'pending' }[];
}): SidebarRow[] {
  const {
    messages, modelName, currentMode, tokensUsed, tokenPercent, totalCost,
    promptStash, lastUserPrompt, lastExportPath, lastCopyStatus,
    lastForkIndex, forkUndoMessages, sidebarInnerWidth,
    sessionTitle = 'MiniAgent Chat',
    timestamps = false,
    showThinking = true,
    showToolDetails = true,
    modifiedFiles = [],
    todos = [],
  } = opts;
  const line = (text = '') => fillByWidth(text, sidebarInnerWidth);
  const rule = () => line(TUI_GLYPHS.divider.repeat(sidebarInnerWidth));
  const pill = (text: string) => ` ${text} `;
  const toggle = (label: string, on: boolean) => `${on ? '●' : '○'} ${label}`;

  const rows: SidebarRow[] = [
    { text: line('Session'), bold: true },
    { text: rule(), dim: true },
    { text: line(sessionTitle), color: TUI_THEME.accent },
    { text: line(`${messages} messages`), dim: true },
    { text: line() },
    { text: line('Model'), bold: true },
    { text: rule(), dim: true },
    { text: line(modelName), dim: true },
    { text: line(pill(currentMode)), color: TUI_THEME.accent },
    { text: line() },
    { text: line('Context'), bold: true },
    { text: rule(), dim: true },
    { text: line(`${tokensUsed.toLocaleString()} tokens`), dim: true },
    { text: line(`${tokenPercent}% used`), dim: true },
    { text: line(`${totalCost} spent`), dim: true },
    { text: line() },
    { text: line('System'), bold: true },
    { text: rule(), dim: true },
    { text: line(pill('Slash ready')), color: TUI_THEME.success },
    { text: line(promptStash ? 'Draft saved' : 'No draft'), dim: !promptStash, color: promptStash ? TUI_THEME.warning : undefined },
    { text: line(lastUserPrompt ? 'Retry ready' : 'No retry'), dim: !lastUserPrompt, color: lastUserPrompt ? TUI_THEME.success : undefined },
    { text: line(lastExportPath ? 'Exported session' : 'Ctrl+E export'), dim: !lastExportPath, color: lastExportPath ? TUI_THEME.success : undefined },
    { text: line(lastCopyStatus === 'copied' ? 'Copied message' : lastCopyStatus === 'fallback' ? 'Copy fallback' : 'C copy timeline'), dim: lastCopyStatus === 'idle', color: lastCopyStatus === 'copied' ? TUI_THEME.success : lastCopyStatus === 'fallback' ? TUI_THEME.warning : undefined },
    { text: line(lastForkIndex ? `Forked at #${lastForkIndex}` : 'F fork timeline'), dim: !lastForkIndex, color: lastForkIndex ? TUI_THEME.warning : undefined },
    { text: line(forkUndoMessages ? 'U undo fork' : 'No undo'), dim: !forkUndoMessages, color: forkUndoMessages ? TUI_THEME.warning : undefined },
    { text: line('Ctrl+T timeline'), dim: true },
    { text: line('Ctrl+Z undo'), dim: true },
    { text: line('Ctrl+↑/↓ scroll'), dim: true },
    { text: line() },
  ];

  // Modified files panel
  if (modifiedFiles.length > 0) {
    rows.push({ text: line('Modified Files'), bold: true });
    rows.push({ text: rule(), dim: true });
    modifiedFiles.slice(0, 5).forEach(f => {
      const diff = `+${f.added} -${f.removed}`;
      rows.push({ text: line(`${f.path} ${diff}`), dim: true });
    });
    if (modifiedFiles.length > 5) {
      rows.push({ text: line(`... ${modifiedFiles.length - 5} more`), dim: true });
    }
    rows.push({ text: line() });
  }

  // Todo panel
  if (todos.length > 0) {
    rows.push({ text: line('Todos'), bold: true });
    rows.push({ text: rule(), dim: true });
    const pending = todos.filter(t => t.status === 'pending');
    const inProgress = todos.filter(t => t.status === 'in_progress');
    const done = todos.filter(t => t.status === 'done');
    if (inProgress.length > 0) {
      rows.push({ text: line(`◉ ${inProgress.length} in progress`), color: TUI_THEME.warning });
    }
    if (pending.length > 0) {
      rows.push({ text: line(`○ ${pending.length} pending`), dim: true });
    }
    if (done.length > 0) {
      rows.push({ text: line(`✓ ${done.length} completed`), color: TUI_THEME.success });
    }
    rows.push({ text: line() });
  }

  rows.push(
    { text: line('Display'), bold: true },
    { text: rule(), dim: true },
    { text: line(toggle('Timestamps', timestamps)), dim: !timestamps },
    { text: line(toggle('Thinking', showThinking)), dim: !showThinking },
    { text: line(toggle('Tool details', showToolDetails)), dim: !showToolDetails },
    { text: line('Ctrl+Shift+T/H/D'), dim: true },
    { text: line('0 LSP'), dim: true },
  );

  return rows;
}

export function buildSidebarFooterRows(opts: {
  version: string;
  sidebarInnerWidth: number;
  cwd?: string;
}): SidebarRow[] {
  const line = (text = '') => fillByWidth(text, opts.sidebarInnerWidth);
  const rule = () => line(TUI_GLYPHS.divider.repeat(opts.sidebarInnerWidth));
  return [
    { text: rule(), dim: true },
    ...(opts.cwd ? [{ text: line(`${opts.cwd}:main`), dim: true }] : []),
    { text: line(`• MiniAgent ${opts.version}`), color: TUI_THEME.success },
    { text: line('by Zevan'), dim: true },
  ];
}

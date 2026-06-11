import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';

export interface StatusItem {
  category: string;
  name: string;
  status: 'ok' | 'error' | 'warning' | 'info';
  detail?: string;
}

export interface StatusDialogProps {
  items: StatusItem[];
  termWidth: number;
  termHeight: number;
}

export function StatusDialog({ items, termWidth, termHeight }: StatusDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const maxVisible = Math.max(4, termHeight - 8);

  const statusColor = (s: string) => {
    if (s === 'ok') return TUI_THEME.success;
    if (s === 'error') return 'red';
    if (s === 'warning') return TUI_THEME.warning;
    return TUI_THEME.muted;
  };

  const statusIcon = (s: string) => {
    if (s === 'ok') return '●';
    if (s === 'error') return '✗';
    if (s === 'warning') return '⚠';
    return '○';
  };

  const grouped = new Map<string, StatusItem[]>();
  for (const item of items) {
    const list = grouped.get(item.category) || [];
    list.push(item);
    grouped.set(item.category, list);
  }

  let lineCount = 0;

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.accent} bold>Status</Text>
        <Box marginTop={1} flexDirection="column">
          {Array.from(grouped.entries()).map(([category, catItems]) => {
            if (lineCount >= maxVisible) return null;
            lineCount++;
            return (
              <Box key={category} flexDirection="column">
                <Text color={TUI_THEME.warning} bold>{category}</Text>
                {catItems.slice(0, 5).map(item => {
                  if (lineCount >= maxVisible) return null;
                  lineCount++;
                  return (
                    <Box key={item.name} justifyContent="space-between">
                      <Text><Text color={statusColor(item.status)}>{statusIcon(item.status)}</Text> {item.name}</Text>
                      <Text dimColor>{item.detail || item.status}</Text>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Esc close</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface StatusState {
  isOpen: boolean;
  items: StatusItem[];
}

export function createStatusState(): StatusState {
  return { isOpen: false, items: [] };
}

export function openStatus(state: StatusState, items: StatusItem[]): StatusState {
  return { ...state, isOpen: true, items };
}

export function closeStatus(state: StatusState): StatusState {
  return { ...state, isOpen: false };
}

import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';
import type { Session } from './SessionManager.js';
import { formatRelativeTime, sortSessions } from './SessionManager.js';

export interface SessionListDialogProps {
  sessions: Session[];
  currentSessionId: string | null;
  selectedIndex: number;
  filter: string;
  termWidth: number;
  termHeight: number;
  showPreview: boolean;
}

export function SessionListDialog({ sessions, currentSessionId, selectedIndex, filter, termWidth, termHeight, showPreview }: SessionListDialogProps) {
  const width = Math.min(termWidth - 4, showPreview ? 100 : 76);
  const listWidth = showPreview ? Math.floor(width * 0.5) : width - 4;
  const previewWidth = showPreview ? width - listWidth - 2 : 0;
  const contentWidth = listWidth - 4;
  const maxVisible = Math.max(4, termHeight - 8);

  const lowerFilter = filter.toLowerCase();
  const filtered = sortSessions(sessions.filter(s =>
    !lowerFilter ||
    s.title.toLowerCase().includes(lowerFilter) ||
    s.messages.some(m => m.content.toLowerCase().includes(lowerFilter))
  ));

  const pinned = filtered.filter(s => s.pinned);
  const unpinned = filtered.filter(s => !s.pinned);
  const groups = [
    ...(pinned.length > 0 ? [{ label: 'Pinned', items: pinned }] : []),
    ...(unpinned.length > 0 ? [{ label: 'Recent', items: unpinned }] : []),
  ];

  let globalIndex = 0;
  const selectedSession = filtered[selectedIndex];

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="row" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        {/* Session list */}
        <Box flexDirection="column" width={listWidth}>
          <Box justifyContent="space-between">
            <Text color={TUI_THEME.accent} bold>Sessions</Text>
            <Text dimColor>{filter ? `Filter: ${filter}` : `${filtered.length} sessions`}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {groups.map(group => (
              <Box key={group.label} flexDirection="column">
                <Text color={TUI_THEME.warning} bold>{group.label}</Text>
                {group.items.slice(0, maxVisible).map(session => {
                  const idx = globalIndex++;
                  const isSelected = idx === selectedIndex;
                  const isCurrent = session.id === currentSessionId;
                  return (
                    <Box key={session.id} justifyContent="space-between">
                      <Text
                        color={isSelected ? TUI_THEME.accent : isCurrent ? TUI_THEME.success : undefined}
                        bold={isSelected}
                      >{isSelected ? '▸ ' : '  '}{session.pinned ? '📌 ' : ''}{truncateByWidth(session.title, contentWidth - 16).text}</Text>
                      <Text dimColor>{formatRelativeTime(session.updatedAt)}</Text>
                    </Box>
                  );
                })}
              </Box>
            ))}
            {filtered.length === 0 && <Text dimColor>No sessions found</Text>}
          </Box>
          <Box marginTop={1} justifyContent="space-between">
            <Text dimColor>↑↓ move</Text>
            <Text dimColor>Enter load</Text>
            <Text dimColor>p pin</Text>
            <Text dimColor>d delete</Text>
          </Box>
        </Box>

        {/* Preview pane */}
        {showPreview && selectedSession && (
          <Box flexDirection="column" width={previewWidth} marginLeft={1} borderStyle="single" borderColor={TUI_THEME.muted} paddingX={1}>
            <Text color={TUI_THEME.accent} bold>{truncateByWidth(selectedSession.title, previewWidth - 4).text}</Text>
            <Text dimColor>{selectedSession.messages.length} messages · {formatRelativeTime(selectedSession.updatedAt)}</Text>
            {selectedSession.model && <Text dimColor>Model: {selectedSession.model}</Text>}
            {selectedSession.mode && <Text dimColor>Mode: {selectedSession.mode}</Text>}
            <Box marginTop={1} flexDirection="column">
              {selectedSession.messages.slice(-4).map((msg, i) => (
                <Box key={i}>
                  <Text dimColor>{msg.role === 'user' ? 'You' : 'AI'}: </Text>
                  <Text>{truncateByWidth(msg.content, previewWidth - 10).text}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export interface SessionListState {
  isOpen: boolean;
  selectedIndex: number;
  filter: string;
}

export function createSessionListState(): SessionListState {
  return { isOpen: false, selectedIndex: 0, filter: '' };
}

export function openSessionList(state: SessionListState): SessionListState {
  return { ...state, isOpen: true, selectedIndex: 0, filter: '' };
}

export function closeSessionList(state: SessionListState): SessionListState {
  return { ...state, isOpen: false, filter: '' };
}

export function sessionListUp(state: SessionListState): SessionListState {
  return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };
}

export function sessionListDown(state: SessionListState, total: number): SessionListState {
  return { ...state, selectedIndex: Math.min(total - 1, state.selectedIndex + 1) };
}

export function sessionListType(state: SessionListState, char: string): SessionListState {
  return { ...state, filter: state.filter + char, selectedIndex: 0 };
}

export function sessionListBackspace(state: SessionListState): SessionListState {
  return { ...state, filter: state.filter.slice(0, -1), selectedIndex: 0 };
}

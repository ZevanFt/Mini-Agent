import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';
import type { Session } from './SessionManager.js';
import { formatRelativeTime, sortSessions } from './SessionManager.js';
import { fuzzySearch } from './FuzzySearch.js';

export interface SessionListDialogProps {
  sessions: Session[];
  currentSessionId: string | null;
  selectedIndex: number;
  filter: string;
  termWidth: number;
  termHeight: number;
  showPreview: boolean;
  quickSwitchSlots?: (string | null)[];
}

function getDateGroup(updatedAt: number): string {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const diff = now - updatedAt;
  if (diff < day) return 'Today';
  if (diff < 2 * day) return 'Yesterday';
  if (diff < 7 * day) return 'This Week';
  return 'Older';
}

export function SessionListDialog({ sessions, currentSessionId, selectedIndex, filter, termWidth, termHeight, showPreview, quickSwitchSlots }: SessionListDialogProps) {
  const width = Math.min(termWidth - 4, showPreview ? 100 : 76);
  const listWidth = showPreview ? Math.floor(width * 0.5) : width - 4;
  const previewWidth = showPreview ? width - listWidth - 2 : 0;
  const contentWidth = listWidth - 4;
  const maxVisible = Math.max(4, termHeight - 8);

  // Fuzzy search
  const filtered = filter
    ? fuzzySearch(filter, sessions, s => s.title).map(r => r.item)
    : sortSessions(sessions);

  const pinned = filtered.filter(s => s.pinned);
  const unpinned = filtered.filter(s => !s.pinned);

  // Date-based grouping for unpinned
  const dateGroups = new Map<string, Session[]>();
  for (const s of unpinned) {
    const group = getDateGroup(s.updatedAt);
    const list = dateGroups.get(group) || [];
    list.push(s);
    dateGroups.set(group, list);
  }

  const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
  const groups = [
    ...(pinned.length > 0 ? [{ label: 'Pinned', items: pinned }] : []),
    ...groupOrder.filter(g => dateGroups.has(g)).map(g => ({ label: g, items: dateGroups.get(g)! })),
  ];

  let globalIndex = 0;
  const selectedSession = filtered[selectedIndex];

  // Find slot number for a session
  const getSlotNumber = (sessionId: string): number | null => {
    if (!quickSwitchSlots) return null;
    const idx = quickSwitchSlots.indexOf(sessionId);
    return idx >= 0 ? idx + 1 : null;
  };

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
                  const slotNum = getSlotNumber(session.id);
                  return (
                    <Box key={session.id} justifyContent="space-between">
                      <Text
                        color={isSelected ? TUI_THEME.accent : isCurrent ? TUI_THEME.success : undefined}
                        bold={isSelected}
                      >{isSelected ? '▸ ' : '  '}{slotNum !== null ? <Text color={TUI_THEME.accent}>{slotNum}</Text> : ''}{session.pinned ? '📌 ' : ''}{truncateByWidth(session.title, contentWidth - 16).text}</Text>
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
          <Box flexDirection="column" width={previewWidth} borderStyle="single" borderColor={TUI_THEME.muted} paddingX={1} marginLeft={1}>
            <Text color={TUI_THEME.accent} bold>{truncateByWidth(selectedSession.title, previewWidth - 4).text}</Text>
            <Text dimColor>{selectedSession.messages.length} messages</Text>
            <Text dimColor>{formatRelativeTime(selectedSession.updatedAt)}</Text>
            <Box marginTop={1} flexDirection="column">
              {selectedSession.messages.slice(-3).map((msg, i) => (
                <Text key={i} dimColor>{msg.role === 'user' ? 'Q' : 'A'}: {truncateByWidth(msg.content.split('\n')[0], previewWidth - 6).text}</Text>
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

export function sessionListDown(state: SessionListState, max: number): SessionListState {
  return { ...state, selectedIndex: Math.min(max - 1, state.selectedIndex + 1) };
}

export function sessionListType(state: SessionListState, char: string): SessionListState {
  return { ...state, filter: state.filter + char, selectedIndex: 0 };
}

export function sessionListBackspace(state: SessionListState): SessionListState {
  return { ...state, filter: state.filter.slice(0, -1), selectedIndex: 0 };
}

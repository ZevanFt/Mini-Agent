import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface KeyBinding {
  keys: string;
  description: string;
  category: string;
}

export const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  // Navigation
  { keys: 'Enter', description: 'Send message', category: 'Input' },
  { keys: 'Shift+Enter', description: 'New line', category: 'Input' },
  { keys: '↑/↓', description: 'History / cursor up/down', category: 'Input' },
  { keys: '←/→', description: 'Cursor left/right', category: 'Input' },
  { keys: 'Home', description: 'Cursor to line start', category: 'Input' },
  { keys: 'End', description: 'Cursor to line end', category: 'Input' },
  { keys: 'Ctrl+←', description: 'Word left', category: 'Input' },
  { keys: 'Ctrl+→', description: 'Word right', category: 'Input' },
  { keys: 'Ctrl+A', description: 'Select all / line start', category: 'Input' },
  { keys: 'Ctrl+E', description: 'Line end', category: 'Input' },
  { keys: 'Ctrl+K', description: 'Delete to line end', category: 'Input' },
  { keys: 'Ctrl+U', description: 'Delete to line start / stash', category: 'Input' },
  { keys: 'Ctrl+W', description: 'Delete word left', category: 'Input' },
  { keys: 'Ctrl+D', description: 'Delete char / forward delete', category: 'Input' },

  // Session
  { keys: 'Ctrl+C', description: 'Exit confirm', category: 'Session' },
  { keys: 'Ctrl+D', description: 'Exit confirm', category: 'Session' },
  { keys: 'Ctrl+L', description: 'Clear chat', category: 'Session' },
  { keys: 'Ctrl+N', description: 'New session', category: 'Session' },
  { keys: 'Ctrl+O', description: 'Open session list', category: 'Session' },
  { keys: 'Ctrl+S', description: 'Save session', category: 'Session' },

  // Commands
  { keys: 'Ctrl+P', description: 'Command palette', category: 'Commands' },
  { keys: '/', description: 'Inline commands', category: 'Commands' },
  { keys: 'Tab', description: 'Switch Build/Plan mode', category: 'Commands' },

  // Navigation
  { keys: 'PageUp', description: 'Scroll up', category: 'Scroll' },
  { keys: 'PageDown', description: 'Scroll down', category: 'Scroll' },
  { keys: 'Ctrl+↑', description: 'Half page up', category: 'Scroll' },
  { keys: 'Ctrl+↓', description: 'Half page down', category: 'Scroll' },
  { keys: 'Ctrl+Home', description: 'Scroll to top', category: 'Scroll' },
  { keys: 'Ctrl+End', description: 'Scroll to bottom', category: 'Scroll' },

  // Toggles
  { keys: 'Ctrl+Shift+T', description: 'Toggle timestamps', category: 'Display' },
  { keys: 'Ctrl+Shift+H', description: 'Toggle thinking', category: 'Display' },
  { keys: 'Ctrl+Shift+D', description: 'Toggle tool details', category: 'Display' },
  { keys: 'Ctrl+Shift+S', description: 'Toggle scrollbar', category: 'Display' },
  { keys: 'Ctrl+Shift+B', description: 'Toggle sidebar', category: 'Display' },
  { keys: 'Ctrl+Shift+G', description: 'Toggle code conceal', category: 'Display' },

  // History
  { keys: 'Ctrl+R', description: 'Retry last message', category: 'History' },
  { keys: 'Ctrl+Y', description: 'Restore draft', category: 'History' },
  { keys: 'Ctrl+Z', description: 'Undo', category: 'History' },
  { keys: 'Ctrl+Shift+Z', description: 'Redo', category: 'History' },

  // Export
  { keys: 'Ctrl+E', description: 'Export session', category: 'Export' },
  { keys: 'Ctrl+Shift+C', description: 'Copy transcript', category: 'Export' },
  { keys: 'Ctrl+T', description: 'Timeline', category: 'Export' },

  // Model
  { keys: 'Ctrl+M', description: 'Model selector', category: 'Model' },
  { keys: 'Ctrl+Shift+A', description: 'Agent selector', category: 'Model' },

  // Theme
  { keys: 'Ctrl+Shift+X', description: 'Cycle theme', category: 'Theme' },

  // Help
  { keys: 'F1', description: 'Keyboard shortcuts', category: 'Help' },
  { keys: 'Ctrl+?', description: 'Keyboard shortcuts', category: 'Help' },
];

export interface WhichKeyProps {
  bindings: KeyBinding[];
  termWidth: number;
  termHeight: number;
  filter?: string;
  activeCategory?: number;
  layoutMode?: 'overlay' | 'dock';
}

export function WhichKey({ bindings, termWidth, termHeight, filter, activeCategory = 0, layoutMode = 'overlay' }: WhichKeyProps) {
  const width = Math.min(termWidth - 8, 76);
  const contentWidth = width - 6;
  const maxVisible = Math.max(4, termHeight - 8);

  const lowerFilter = (filter || '').toLowerCase();
  const filtered = bindings.filter(b =>
    !lowerFilter ||
    b.keys.toLowerCase().includes(lowerFilter) ||
    b.description.toLowerCase().includes(lowerFilter) ||
    b.category.toLowerCase().includes(lowerFilter)
  );

  const categories = [...new Set(bindings.map(b => b.category))];
  const activeCat = categories[activeCategory] || categories[0] || '';
  const grouped = new Map<string, KeyBinding[]>();
  for (const b of filtered) {
    const list = grouped.get(b.category) || [];
    list.push(b);
    grouped.set(b.category, list);
  }

  const activeItems = lowerFilter ? filtered : (grouped.get(activeCat) || []);
  let totalLines = 0;

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent={layoutMode === 'dock' ? 'flex-end' : 'center'} alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Keyboard Shortcuts</Text>
          <Text dimColor>{filter ? `Filter: ${filter}` : `${filtered.length} bindings`}</Text>
        </Box>
        {/* Category tabs */}
        <Box marginTop={1}>
          {categories.map((cat, i) => (
            <Text key={cat} color={i === activeCategory ? TUI_THEME.accent : TUI_THEME.muted} bold={i === activeCategory}>
              {i === activeCategory ? ` ${cat} ` : ` ${cat} `}
            </Text>
          ))}
        </Box>
        <Box marginTop={1} flexDirection="column">
          {lowerFilter ? (
            filtered.slice(0, maxVisible).map(binding => {
              totalLines += 1;
              return (
                <Box key={binding.keys} justifyContent="space-between" width={contentWidth}>
                  <Text color={TUI_THEME.accent}>{truncateByWidth(binding.keys, 20).text}</Text>
                  <Text dimColor>{truncateByWidth(binding.description, contentWidth - 22).text}</Text>
                </Box>
              );
            })
          ) : (
            activeItems.slice(0, maxVisible).map(binding => {
              totalLines += 1;
              return (
                <Box key={binding.keys} justifyContent="space-between" width={contentWidth}>
                  <Text color={TUI_THEME.accent}>{truncateByWidth(binding.keys, 20).text}</Text>
                  <Text dimColor>{truncateByWidth(binding.description, contentWidth - 22).text}</Text>
                </Box>
              );
            })
          )}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>←→ category</Text>
          <Text dimColor>/ filter</Text>
          <Text dimColor>d dock</Text>
          <Text dimColor>Esc close</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface WhichKeyState {
  isOpen: boolean;
  filter: string;
  scrollOffset: number;
  activeCategory: number;
  layoutMode: 'overlay' | 'dock';
}

export function createWhichKeyState(): WhichKeyState {
  return { isOpen: false, filter: '', scrollOffset: 0, activeCategory: 0, layoutMode: 'overlay' };
}

export function openWhichKey(state: WhichKeyState): WhichKeyState {
  return { ...state, isOpen: true, filter: '', scrollOffset: 0, activeCategory: 0 };
}

export function closeWhichKey(state: WhichKeyState): WhichKeyState {
  return { ...state, isOpen: false, filter: '' };
}

export function whichKeyNextCategory(state: WhichKeyState, categoryCount: number): WhichKeyState {
  return { ...state, activeCategory: (state.activeCategory + 1) % categoryCount };
}

export function whichKeyPrevCategory(state: WhichKeyState, categoryCount: number): WhichKeyState {
  return { ...state, activeCategory: (state.activeCategory - 1 + categoryCount) % categoryCount };
}

export function whichKeyToggleLayout(state: WhichKeyState): WhichKeyState {
  return { ...state, layoutMode: state.layoutMode === 'overlay' ? 'dock' : 'overlay' };
}

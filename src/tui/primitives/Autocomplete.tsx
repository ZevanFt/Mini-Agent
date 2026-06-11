import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';
import { fuzzySearch } from './FuzzySearch.js';

export interface AutocompleteItem {
  id: string;
  label: string;
  description?: string;
  type: 'file' | 'command' | 'agent' | 'tag' | 'model';
  path?: string;
  icon?: string;
}

export interface AutocompleteProps {
  items: AutocompleteItem[];
  selectedIndex: number;
  filter: string;
  trigger: '@' | '/' | '#' | 'model';
  termWidth: number;
  maxHeight?: number;
}

const TRIGGER_ICONS: Record<string, string> = {
  '@': '📎',
  '/': '⚡',
  '#': '🏷',
  'model': '🤖',
};

export function Autocomplete({ items, selectedIndex, filter, trigger, termWidth, maxHeight = 10 }: AutocompleteProps) {
  const width = Math.min(termWidth - 4, 60);
  const contentWidth = width - 4;

  const filtered = filter
    ? fuzzySearch(filter, items, item => `${item.label} ${item.description || ''}`).map(r => r.item)
    : items;

  const visible = filtered.slice(0, maxHeight);
  const hasMore = filtered.length > maxHeight;

  if (visible.length === 0) {
    return (
      <Box width={width} paddingX={1}>
        <Text dimColor>No matching items</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} borderStyle="single" borderColor={TUI_THEME.accent} paddingX={1}>
      {visible.map((item, i) => {
        const isSelected = i === selectedIndex;
        const icon = item.icon || TRIGGER_ICONS[trigger] || '•';
        return (
          <Box key={item.id} justifyContent="space-between">
            <Text color={isSelected ? TUI_THEME.accent : TUI_THEME.muted} bold={isSelected}>
              {isSelected ? '▸ ' : '  '}{icon} {truncateByWidth(item.label, contentWidth - 12).text}
            </Text>
            {item.description && (
              <Text dimColor>{truncateByWidth(item.description, 16).text}</Text>
            )}
          </Box>
        );
      })}
      {hasMore && (
        <Text dimColor>  ... {filtered.length - maxHeight} more</Text>
      )}
    </Box>
  );
}

export interface AutocompleteState {
  isOpen: boolean;
  trigger: '@' | '/' | '#' | 'model' | null;
  filter: string;
  selectedIndex: number;
  items: AutocompleteItem[];
  startCol: number;
}

export function createAutocompleteState(): AutocompleteState {
  return { isOpen: false, trigger: null, filter: '', selectedIndex: 0, items: [], startCol: 0 };
}

export function openAutocomplete(state: AutocompleteState, trigger: '@' | '/' | '#' | 'model', items: AutocompleteItem[], startCol: number): AutocompleteState {
  return { ...state, isOpen: true, trigger, filter: '', selectedIndex: 0, items, startCol };
}

export function closeAutocomplete(state: AutocompleteState): AutocompleteState {
  return { ...state, isOpen: false, trigger: null, filter: '', items: [] };
}

export function autocompleteType(state: AutocompleteState, char: string): AutocompleteState {
  return { ...state, filter: state.filter + char, selectedIndex: 0 };
}

export function autocompleteBackspace(state: AutocompleteState): AutocompleteState {
  if (state.filter.length === 0) return closeAutocomplete(state);
  return { ...state, filter: state.filter.slice(0, -1), selectedIndex: 0 };
}

export function autocompleteUp(state: AutocompleteState): AutocompleteState {
  return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };
}

export function autocompleteDown(state: AutocompleteState): AutocompleteState {
  const max = state.items.length - 1;
  return { ...state, selectedIndex: Math.min(max, state.selectedIndex + 1) };
}

export function getSelectedAutocomplete(state: AutocompleteState): AutocompleteItem | null {
  const filtered = state.filter
    ? fuzzySearch(state.filter, state.items, item => `${item.label} ${item.description || ''}`).map(r => r.item)
    : state.items;
  return filtered[state.selectedIndex] || null;
}

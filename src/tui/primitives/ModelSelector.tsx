import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';
import { fuzzySearch } from './FuzzySearch.js';

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description?: string;
  favorite?: boolean;
  recent?: boolean;
  contextLength?: string;
}

export interface ModelSelectorProps {
  models: ModelInfo[];
  selectedIndex: number;
  filter: string;
  termWidth: number;
  termHeight: number;
  onSelect: (model: ModelInfo) => void;
  onClose: () => void;
}

export function ModelSelector({ models, selectedIndex, filter, termWidth, termHeight, onSelect: _onSelect, onClose: _onClose }: ModelSelectorProps) {
  const width = Math.min(termWidth - 8, 80);
  const contentWidth = width - 6;
  const maxVisible = Math.max(4, termHeight - 8);

  // Fuzzy search
  const filtered = filter
    ? fuzzySearch(filter, models, m => `${m.name} ${m.provider}`).map(r => r.item)
    : models;

  const favorites = filtered.filter(m => m.favorite);
  const recents = filtered.filter(m => m.recent && !m.favorite);
  const others = filtered.filter(m => !m.favorite && !m.recent);

  const groups = [
    ...(favorites.length > 0 ? [{ label: 'Favorites', items: favorites }] : []),
    ...(recents.length > 0 ? [{ label: 'Recent', items: recents }] : []),
    ...(others.length > 0 ? [{ label: 'All Models', items: others }] : []),
  ];

  let globalIndex = 0;

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Models</Text>
          <Text dimColor>{filter ? `Filter: ${filter}` : `${filtered.length} models`}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {groups.map(group => (
            <Box key={group.label} flexDirection="column">
              <Text color={TUI_THEME.warning} bold>{group.label}</Text>
              {group.items.slice(0, maxVisible).map(model => {
                const idx = globalIndex++;
                const isSelected = idx === selectedIndex;
                return (
                  <Box key={model.id} justifyContent="space-between">
                    <Text
                      color={isSelected ? TUI_THEME.accent : TUI_THEME.muted}
                      bold={isSelected}
                    >{isSelected ? '▸ ' : '  '}{model.favorite ? '★ ' : ''}{truncateByWidth(model.name, contentWidth - 20).text}</Text>
                    <Text dimColor>{truncateByWidth(model.provider, 16).text}</Text>
                  </Box>
                );
              })}
            </Box>
          ))}
          {filtered.length === 0 && <Text dimColor>No models found</Text>}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>/ filter</Text>
          <Text dimColor>Enter select</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface ModelSelectorState {
  isOpen: boolean;
  selectedIndex: number;
  filter: string;
  models: ModelInfo[];
}

export function createModelSelectorState(): ModelSelectorState {
  return { isOpen: false, selectedIndex: 0, filter: '', models: [] };
}

export function openModelSelector(state: ModelSelectorState, models: ModelInfo[]): ModelSelectorState {
  const recentIdx = models.findIndex(m => m.recent);
  return { ...state, isOpen: true, models, selectedIndex: recentIdx >= 0 ? recentIdx : 0, filter: '' };
}

export function closeModelSelector(state: ModelSelectorState): ModelSelectorState {
  return { ...state, isOpen: false, filter: '' };
}

export function modelSelectorUp(state: ModelSelectorState): ModelSelectorState {
  return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };
}

export function modelSelectorDown(state: ModelSelectorState, max: number): ModelSelectorState {
  return { ...state, selectedIndex: Math.min(max - 1, state.selectedIndex + 1) };
}

export function modelSelectorType(state: ModelSelectorState, char: string): ModelSelectorState {
  return { ...state, filter: state.filter + char, selectedIndex: 0 };
}

export function modelSelectorBackspace(state: ModelSelectorState): ModelSelectorState {
  return { ...state, filter: state.filter.slice(0, -1), selectedIndex: 0 };
}

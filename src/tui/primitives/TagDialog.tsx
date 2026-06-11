import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface Tag {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symbol';
}

export interface TagDialogProps {
  tags: Tag[];
  selectedIndex: number;
  filter: string;
  termWidth: number;
  termHeight: number;
}

export function TagDialog({ tags, selectedIndex, filter, termWidth, termHeight }: TagDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const contentWidth = width - 6;
  const maxVisible = Math.max(4, termHeight - 8);
  const lowerFilter = filter.toLowerCase();
  const filtered = tags.filter(t => !lowerFilter || t.name.toLowerCase().includes(lowerFilter) || t.path.toLowerCase().includes(lowerFilter));

  const typeIcon = (t: string) => {
    if (t === 'file') return '📄';
    if (t === 'dir') return '📁';
    return '⊕';
  };

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Tags</Text>
          <Text dimColor>{filtered.length} items</Text>
        </Box>
        {filter && <Text dimColor>Filter: {filter}</Text>}
        <Box marginTop={1} flexDirection="column">
          {filtered.slice(0, maxVisible).map((tag, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={tag.path} justifyContent="space-between">
                <Text color={isSelected ? TUI_THEME.accent : undefined} bold={isSelected}>
                  {isSelected ? '▸ ' : '  '}{typeIcon(tag.type)} {truncateByWidth(tag.name, contentWidth - 20).text}
                </Text>
                <Text dimColor>{truncateByWidth(tag.path, 20).text}</Text>
              </Box>
            );
          })}
          {filtered.length === 0 && <Text dimColor>No tags found</Text>}
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

export interface TagState {
  isOpen: boolean;
  selectedIndex: number;
  filter: string;
  tags: Tag[];
}

export function createTagState(): TagState {
  return { isOpen: false, selectedIndex: 0, filter: '', tags: [] };
}

export function openTag(state: TagState, tags: Tag[]): TagState {
  return { ...state, isOpen: true, tags, selectedIndex: 0, filter: '' };
}

export function closeTag(state: TagState): TagState {
  return { ...state, isOpen: false, filter: '' };
}

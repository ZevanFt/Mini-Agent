import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface Variant {
  id: string;
  name: string;
  provider: string;
  description?: string;
  isActive: boolean;
}

export interface VariantDialogProps {
  variants: Variant[];
  selectedIndex: number;
  filter: string;
  termWidth: number;
  termHeight: number;
}

export function VariantDialog({ variants, selectedIndex, filter, termWidth, termHeight }: VariantDialogProps) {
  const width = Math.min(termWidth - 8, 64);
  const maxVisible = Math.max(4, termHeight - 8);
  const lowerFilter = filter.toLowerCase();
  const filtered = variants.filter(v => !lowerFilter || v.name.toLowerCase().includes(lowerFilter) || v.provider.toLowerCase().includes(lowerFilter));

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Box justifyContent="space-between">
          <Text color={TUI_THEME.accent} bold>Model Variants</Text>
          <Text dimColor>{filtered.length} variants</Text>
        </Box>
        {filter && <Text dimColor>Filter: {filter}</Text>}
        <Box marginTop={1} flexDirection="column">
          {filtered.slice(0, maxVisible).map((variant, i) => {
            const isSelected = i === selectedIndex;
            return (
              <Box key={variant.id} justifyContent="space-between">
                <Text color={isSelected ? TUI_THEME.accent : variant.isActive ? TUI_THEME.success : undefined} bold={isSelected}>
                  {isSelected ? '▸ ' : '  '}{variant.name}
                </Text>
                <Text dimColor>{truncateByWidth(variant.provider, 16).text}</Text>
              </Box>
            );
          })}
          {filtered.length === 0 && <Text dimColor>No variants found</Text>}
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

export interface VariantState {
  isOpen: boolean;
  selectedIndex: number;
  filter: string;
  variants: Variant[];
}

export function createVariantState(): VariantState {
  return { isOpen: false, selectedIndex: 0, filter: '', variants: [] };
}

export function openVariant(state: VariantState, variants: Variant[]): VariantState {
  const activeIdx = variants.findIndex(v => v.isActive);
  return { ...state, isOpen: true, variants, selectedIndex: activeIdx >= 0 ? activeIdx : 0, filter: '' };
}

export function closeVariant(state: VariantState): VariantState {
  return { ...state, isOpen: false, filter: '' };
}

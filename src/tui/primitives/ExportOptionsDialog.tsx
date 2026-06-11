import { useState } from 'react';
import { Box, Text } from 'ink';
import { TUI_THEME } from './theme.js';
import { truncateByWidth } from './text.js';

export interface ExportOptions {
  filename: string;
  includeThinking: boolean;
  includeToolDetails: boolean;
  includeMetadata: boolean;
  openWithoutSaving: boolean;
}

export function createDefaultExportOptions(sessionTitle: string): ExportOptions {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return {
    filename: `${sessionTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.md`,
    includeThinking: true,
    includeToolDetails: true,
    includeMetadata: true,
    openWithoutSaving: false,
  };
}

export interface ExportOptionsDialogProps {
  options: ExportOptions;
  selectedIndex: number;
  termWidth: number;
  termHeight: number;
}

const OPTION_LABELS = [
  'Include thinking',
  'Include tool details',
  'Include metadata',
  'Open without saving',
] as const;

export function ExportOptionsDialog({ options, selectedIndex, termWidth, termHeight: _termHeight }: ExportOptionsDialogProps) {
  const [filename, _setFilename] = useState(options.filename);
  const width = Math.min(termWidth - 8, 68);
  const contentWidth = width - 6;

  const toggles = [
    options.includeThinking,
    options.includeToolDetails,
    options.includeMetadata,
    options.openWithoutSaving,
  ];

  return (
    <Box flexDirection="column" width={termWidth} justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={width} borderStyle="double" borderColor={TUI_THEME.accent} paddingX={1} paddingY={1}>
        <Text color={TUI_THEME.accent} bold>Export Options</Text>
        <Box marginTop={1}>
          <Text dimColor>Filename: </Text>
          <Text>{truncateByWidth(filename, contentWidth - 12).text}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          {OPTION_LABELS.map((label, i) => {
            const isSelected = i === selectedIndex;
            const isOn = toggles[i];
            return (
              <Text
                key={label}
                color={isSelected ? TUI_THEME.accent : TUI_THEME.muted}
                bold={isSelected}
              >{isSelected ? '▸ ' : '  '}{isOn ? '☑' : '☐'} {label}</Text>
            );
          })}
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>↑↓ move</Text>
          <Text dimColor>Space toggle</Text>
          <Text dimColor>Enter export</Text>
          <Text dimColor>Esc cancel</Text>
        </Box>
      </Box>
    </Box>
  );
}

export interface ExportOptionsState {
  isOpen: boolean;
  options: ExportOptions;
  selectedIndex: number;
}

export function createExportOptionsState(): ExportOptionsState {
  return {
    isOpen: false,
    options: createDefaultExportOptions(''),
    selectedIndex: 0,
  };
}

export function openExportOptions(state: ExportOptionsState, sessionTitle: string): ExportOptionsState {
  return {
    ...state,
    isOpen: true,
    options: createDefaultExportOptions(sessionTitle),
    selectedIndex: 0,
  };
}

export function closeExportOptions(state: ExportOptionsState): ExportOptionsState {
  return { ...state, isOpen: false };
}

export function exportOptionsUp(state: ExportOptionsState): ExportOptionsState {
  return { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };
}

export function exportOptionsDown(state: ExportOptionsState): ExportOptionsState {
  return { ...state, selectedIndex: Math.min(3, state.selectedIndex + 1) };
}

export function exportOptionsToggle(state: ExportOptionsState): ExportOptionsState {
  const opts = { ...state.options };
  switch (state.selectedIndex) {
    case 0: opts.includeThinking = !opts.includeThinking; break;
    case 1: opts.includeToolDetails = !opts.includeToolDetails; break;
    case 2: opts.includeMetadata = !opts.includeMetadata; break;
    case 3: opts.openWithoutSaving = !opts.openWithoutSaving; break;
  }
  return { ...state, options: opts };
}

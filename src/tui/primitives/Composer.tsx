import { Box, Text } from 'ink';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { fillByWidth, truncateByWidth } from './text.js';
import { Scanner } from './Scanner.js';

export interface ComposerProps {
  inputLines: string[];
  cursorRow: number;
  cursorCol: number;
  currentMode: string;
  modelName: string;
  agentName: string;
  promptStateLabel: string;
  width: number;
  contentWidth: number;
  textWidth: number;
  maxVisibleLines?: number;
  position?: 'start' | 'chat';
  borderColor?: string;
  isProcessing?: boolean;
}

export function Composer({
  inputLines,
  cursorRow,
  cursorCol,
  currentMode,
  modelName,
  agentName,
  promptStateLabel,
  width,
  contentWidth,
  textWidth,
  maxVisibleLines = 5,
  position = 'chat',
  borderColor = '#5969E0',
  isProcessing = false,
}: ComposerProps) {
  const composerInputStart = Math.max(0, cursorRow - maxVisibleLines + 1);
  const visibleInputLines = inputLines.slice(composerInputStart, composerInputStart + maxVisibleLines);

  const composerHintText = (w: number) => {
    if (w < 24) return 'Enter send';
    if (w < 42) return 'Ctrl+P commands   Enter send';
    if (w < 62) return '↑↓ history   Ctrl+P commands   Enter send';
    if (w < 82) return '↑↓ history   Ctrl+P commands   Ctrl+K clear input   Enter send';
    return '↑↓ history   Tab mode   Ctrl+P commands   Ctrl+T timeline   Ctrl+R retry   Ctrl+E export   Ctrl+K clear input   Ctrl+U stash   Ctrl+Y restore   Ctrl+L clear chat   Enter send';
  };

  const inputLineText = (line: string, row: number) => {
    // No visual cursor (▌) — we use the real terminal cursor instead
    const content = row === 0 && row === cursorRow && cursorCol === 0 && line === ''
      ? ` Ask anything...`
      : line;
    return fillByWidth(truncateByWidth(content, textWidth).text, contentWidth);
  };

  const dashLine = TUI_GLYPHS.divider.repeat(contentWidth);
  const pill = (text: string) => ` ${text} `;
  const stateLabel = [
    promptStateLabel,
    inputLines.length > maxVisibleLines ? `${inputLines.length} lines` : '',
  ].filter(Boolean).join(' ');

  if (position === 'start') {
    return (
      <Box width={textWidth + 2} flexDirection="column">
        <Box width={textWidth + 2}>
          <Text backgroundColor={TUI_THEME.panel}>{' '.repeat(textWidth + 2)}</Text>
        </Box>
        {visibleInputLines.flatMap((line, visibleRow) => {
          const row = composerInputStart + visibleRow;
          return [
            <Box key={`line-${row}`} width={textWidth + 2}>
              <Text backgroundColor={TUI_THEME.panel}>{inputLineText(line, row)}</Text>
            </Box>,
            <Box key={`gap-${row}`} width={textWidth + 2}>
              <Text backgroundColor={TUI_THEME.panel}>{' '.repeat(textWidth + 2)}</Text>
            </Box>,
          ];
        })}
        <Box width={textWidth + 2}>
          <Text backgroundColor={TUI_THEME.panel}>{' '.repeat(textWidth + 2)}</Text>
        </Box>
        <Box width={textWidth + 2}>
          <Text color="white" backgroundColor={TUI_THEME.selected}>{pill(currentMode)}</Text>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{fillByWidth(`${TUI_GLYPHS.bullet} ${truncateByWidth(`${modelName} ${agentName} ${stateLabel}`.trim(), textWidth - currentMode.length - 4).text}`, textWidth - currentMode.length)}</Text>
        </Box>
        <Box width={textWidth + 2}>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{dashLine}</Text>
        </Box>
        <Box width={textWidth + 2} justifyContent="flex-end">
          <Text dimColor backgroundColor={TUI_THEME.panel}>{fillByWidth(truncateByWidth(composerHintText(textWidth), textWidth + 2).text, textWidth + 2)}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box width={width} marginX={2} marginBottom={1}>
      <Text color={borderColor}>┃</Text>
      <Box width={width - 1} flexDirection="column">
        <Box width={contentWidth}>
          <Text backgroundColor={TUI_THEME.panel}>{' '.repeat(contentWidth)}</Text>
        </Box>
        {visibleInputLines.flatMap((line, visibleRow) => {
          const row = composerInputStart + visibleRow;
          return [
            <Box key={`line-${row}`} width={contentWidth}>
              <Text backgroundColor={TUI_THEME.panel}>{inputLineText(line, row)}</Text>
            </Box>,
            <Box key={`gap-${row}`} width={contentWidth}>
              <Text backgroundColor={TUI_THEME.panel}>{' '.repeat(contentWidth)}</Text>
            </Box>,
          ];
        })}
        <Box width={contentWidth}>
          <Text backgroundColor={TUI_THEME.panel}>{' '.repeat(contentWidth)}</Text>
        </Box>
        <Box width={contentWidth}>
          <Text color="white" backgroundColor={TUI_THEME.selected}>{pill(currentMode)}</Text>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{fillByWidth(truncateByWidth(`${TUI_GLYPHS.bullet} ${modelName} ${agentName} ${stateLabel}`.trim(), contentWidth - currentMode.length - 2).text, contentWidth - currentMode.length)}</Text>
        </Box>
        {isProcessing && (
          <Box width={contentWidth}>
            <Scanner width={Math.min(10, contentWidth)} color={TUI_THEME.accent} trailColor={TUI_THEME.muted} />
          </Box>
        )}
        <Box width={contentWidth}>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{TUI_GLYPHS.divider.repeat(contentWidth)}</Text>
        </Box>
        <Box width={contentWidth} justifyContent="flex-end">
          <Text dimColor backgroundColor={TUI_THEME.panel}>{fillByWidth(composerHintText(textWidth), contentWidth)}</Text>
        </Box>
      </Box>
    </Box>
  );
}

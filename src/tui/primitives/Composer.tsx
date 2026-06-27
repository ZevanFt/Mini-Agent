import { Box, Text } from 'ink';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { fillByWidth, getStringWidth, truncateByWidth } from './text.js';
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
    if (w < 24) return 'Enter';
    if (w < 48) return 'Tab 模式  Ctrl+P';
    const left = 'Tab 切换模式 · Ctrl+P 设置';
    const right = '@ 文件 · $ 智能体 · / 命令';
    const gap = Math.max(2, w - left.length - right.length);
    return left + ' '.repeat(gap) + right;
  };

  const inputLineText = (line: string, row: number) => {
    const content = row === 0 && row === cursorRow && cursorCol === 0 && line === ''
      ? ` 输入消息... (输入 / 唤起命令)`
      : line;
    return fillByWidth(truncateByWidth(content, textWidth).text, contentWidth);
  };

  const pill = (text: string) => ` ${text} `;
  const stateLabel = [
    promptStateLabel,
    inputLines.length > maxVisibleLines ? `${inputLines.length} lines` : '',
  ].filter(Boolean).join(' ');

  if (position === 'start') {
    const innerW = textWidth + 1;
    return (
      <Box width={textWidth + 2} flexDirection="column">
        {visibleInputLines.flatMap((line, visibleRow) => {
          const row = composerInputStart + visibleRow;
          return [
            <Box key={`line-${row}`} width={textWidth + 2}>
              <Text color={TUI_THEME.accent}>{'> '}</Text>
              <Text backgroundColor={TUI_THEME.panel}>{inputLineText(line, row)}</Text>
            </Box>,
          ];
        })}
        <Box width={textWidth + 2}>
          <Text color={TUI_THEME.accent}>{'  '}</Text>
          <Text color="white" backgroundColor={TUI_THEME.selected}>{pill(currentMode)}</Text>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{fillByWidth(`${TUI_GLYPHS.bullet} ${truncateByWidth(`${modelName} ${agentName} ${stateLabel}`.trim(), innerW - currentMode.length - 4).text}`, innerW - currentMode.length)}</Text>
        </Box>
        <Box width={textWidth + 2}>
          <Text color={TUI_THEME.accent}>{'  '}</Text>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{'─'.repeat(innerW)}</Text>
        </Box>
        <Box width={textWidth + 2} justifyContent="flex-end">
          <Text color={TUI_THEME.accent}>{'  '}</Text>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{fillByWidth(truncateByWidth(composerHintText(innerW), innerW).text, innerW)}</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box width={width} marginX={2} marginBottom={1}>
      <Text color={borderColor}>{'> '}</Text>
      <Box width={width - 1} flexDirection="column">
        {visibleInputLines.flatMap((line, visibleRow) => {
          const row = composerInputStart + visibleRow;
          return [
            <Box key={`line-${row}`} width={contentWidth}>
              <Text backgroundColor={TUI_THEME.panel}>{inputLineText(line, row)}</Text>
            </Box>,
          ];
        })}
        <Box width={contentWidth}>
          <Text color="white" backgroundColor={TUI_THEME.selected}>{pill(currentMode)}</Text>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{fillByWidth(truncateByWidth(`${TUI_GLYPHS.bullet} ${modelName} ${agentName} ${stateLabel}`.trim(), contentWidth - currentMode.length - 2).text, contentWidth - currentMode.length)}</Text>
        </Box>
        <Box width={contentWidth}>
          {isProcessing ? (
            <Scanner width={Math.min(10, contentWidth)} color={TUI_THEME.accent} trailColor={TUI_THEME.muted} />
          ) : (() => {
            const dotsWidth = Math.min(10, contentWidth);
            const hintText = truncateByWidth(composerHintText(textWidth), Math.max(0, contentWidth - dotsWidth)).text;
            const gapLen = Math.max(0, contentWidth - dotsWidth - getStringWidth(hintText));
            const hintLine = '·'.repeat(dotsWidth) + ' '.repeat(gapLen) + hintText;
            return <Text dimColor backgroundColor={TUI_THEME.panel}>{hintLine}</Text>;
          })()}
        </Box>
        <Box width={contentWidth}>
          <Text dimColor backgroundColor={TUI_THEME.panel}>{TUI_GLYPHS.divider.repeat(contentWidth)}</Text>
        </Box>
      </Box>
    </Box>
  );
}

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
  isProcessing = false,
}: ComposerProps) {
  const composerInputStart = Math.max(0, cursorRow - maxVisibleLines + 1);
  const visibleInputLines = inputLines.slice(composerInputStart, composerInputStart + maxVisibleLines);
  const inputBg = TUI_THEME.inputBg;

  const inputLineText = (line: string, row: number) => {
    const content = row === 0 && cursorCol === 0 && line === ''
      ? ` 输入消息... (输入 / 唤起命令)`
      : line;
    return fillByWidth(truncateByWidth(content, textWidth).text, contentWidth);
  };

  const stateLabel = [promptStateLabel].filter(Boolean).join(' ');

  const HintBar = ({ w }: { w: number }) => (
    <Box width={w} justifyContent="space-between">
      <Text>
        <Text color={TUI_THEME.accent}>tab</Text>
        <Text dimColor> 切换模式  </Text>
        <Text color={TUI_THEME.accent}>Ctrl+P</Text>
        <Text dimColor> 设置</Text>
      </Text>
      <Text>
        <Text color={TUI_THEME.accent}>@</Text>
        <Text dimColor> 文件  </Text>
        <Text color={TUI_THEME.accent}>$</Text>
        <Text dimColor> 智能体  </Text>
        <Text color={TUI_THEME.accent}>/</Text>
        <Text dimColor> 命令</Text>
      </Text>
    </Box>
  );

  if (position === 'start') {
    const lineW = textWidth + 2;
    const pad = (s: string) => fillByWidth(s, lineW);
    const currentLine = inputLines[cursorRow] ?? '';
    const displayText = currentLine === '' && cursorCol === 0
      ? '输入消息... (输入 / 唤起命令)' : currentLine;
    const truncated = truncateByWidth(displayText, textWidth - 2).text;
    return (
      <Box width={lineW} flexDirection="column">
        <Text backgroundColor={inputBg}>{pad('')}</Text>
        <Text backgroundColor={inputBg}>{pad('> ' + truncated)}</Text>
        <Text backgroundColor={inputBg}>{pad('')}</Text>
        <Text backgroundColor={inputBg}>{pad('  ' + currentMode + ' ' + TUI_GLYPHS.bullet + ' ' + modelName)}</Text>
        <HintBar w={lineW} />
      </Box>
    );
  }

  return (
    <Box width={width} marginX={2} marginBottom={1} flexDirection="column">
      {visibleInputLines.flatMap((line, visibleRow) => {
        const row = composerInputStart + visibleRow;
        return [
          <Text key={`line-${row}`} backgroundColor={inputBg}>
            {'> '}{inputLineText(line, row)}
          </Text>,
        ];
      })}
      <Text backgroundColor={inputBg}>
        {'  '}
        <Text color={TUI_THEME.accent}>{currentMode}</Text>
        {fillByWidth(`${TUI_GLYPHS.bullet} ${modelName} ${agentName} ${stateLabel}`.trim(), contentWidth - currentMode.length - 2)}
      </Text>
      {isProcessing ? (
        <Scanner width={Math.min(10, contentWidth)} color={TUI_THEME.accent} trailColor={TUI_THEME.muted} />
      ) : (
        <HintBar w={contentWidth} />
      )}
    </Box>
  );
}

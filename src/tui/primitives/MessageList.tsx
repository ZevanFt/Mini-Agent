import { Box, Text } from 'ink';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { fillByWidth, wrapByWidth } from './text.js';
import { Spinner } from './Spinner.js';
import type { Message } from '../types.js';

export interface MessageListProps {
  messages: Message[];
  hiddenMessageCount: number;
  chatTextWidth: number;
  chatAreaWidth: number;
  height: number;
  isProcessing: boolean;
  currentResponse: string;
}

export function MessageList({
  messages,
  hiddenMessageCount,
  chatTextWidth,
  chatAreaWidth,
  height,
  isProcessing,
  currentResponse,
}: MessageListProps) {
  return (
    <Box flexDirection="column" width={chatAreaWidth} height={height} paddingX={2}>
      {hiddenMessageCount > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>{hiddenMessageCount} earlier messages hidden</Text>
        </Box>
      )}
      {messages.map((msg, i) => (
        <MessageItem key={hiddenMessageCount + i} msg={msg} chatTextWidth={chatTextWidth} />
      ))}
      {isProcessing && currentResponse && (
        <Box flexDirection="column">
          <Text color={TUI_THEME.accent}>MiniAgent streaming <Spinner color={TUI_THEME.accent} /></Text>
          <Text>{''}</Text>
          {wrapByWidth(currentResponse, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex}>{line}</Text>
          ))}
          <Text>{''}</Text>
        </Box>
      )}
      {isProcessing && !currentResponse && (
        <Box flexDirection="column">
          <Text color={TUI_THEME.accent}>MiniAgent <Spinner color={TUI_THEME.accent} /></Text>
          <Text dimColor>Waiting for model response...</Text>
        </Box>
      )}
    </Box>
  );
}

function MessageItem({ msg, chatTextWidth }: { msg: Message; chatTextWidth: number }) {
  return (
    <Box key="msg" flexDirection="column" marginBottom={1}>
      {msg.role === 'user' && (
        <Box flexDirection="column">
          <Text dimColor>User</Text>
          <Text backgroundColor={TUI_THEME.panel}>{fillByWidth('', chatTextWidth + 2)}</Text>
          {wrapByWidth(msg.content, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex} color="white" backgroundColor={TUI_THEME.panel}> {fillByWidth(line, chatTextWidth)} </Text>
          ))}
          <Text backgroundColor={TUI_THEME.panel}>{fillByWidth('', chatTextWidth + 2)}</Text>
        </Box>
      )}
      {msg.role === 'assistant' && msg.type === 'thought' && (
        <Box flexDirection="column">
          <Text color={TUI_THEME.warning}>MiniAgent thinking</Text>
          <Text>{''}</Text>
          <Text dimColor>{msg.duration}</Text>
          <Text>{''}</Text>
        </Box>
      )}
      {msg.role === 'assistant' && msg.type === 'tool' && (
        <Box flexDirection="column">
          <Text color={TUI_THEME.success}>Tool {TUI_GLYPHS.bullet} {msg.toolName}</Text>
          <Text>{''}</Text>
          {wrapByWidth(msg.content, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex} dimColor>{line}</Text>
          ))}
          <Text>{''}</Text>
        </Box>
      )}
      {msg.role === 'assistant' && msg.type === 'error' && (
        <Box flexDirection="column">
          <Text color="red">MiniAgent error</Text>
          <Text>{''}</Text>
          {wrapByWidth(msg.content, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex} color="red">{line}</Text>
          ))}
          <Text>{''}</Text>
        </Box>
      )}
      {msg.role === 'assistant' && (msg.type === 'text' || !msg.type) && (
        <Box flexDirection="column">
          <Text color={TUI_THEME.accent}>MiniAgent</Text>
          <Text>{''}</Text>
          {wrapByWidth(msg.content, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex}>{line}</Text>
          ))}
          <Text>{''}</Text>
        </Box>
      )}
    </Box>
  );
}

export function messageLineCount(msg: Message, chatTextWidth: number): number {
  const contentLines = wrapByWidth(msg.content, chatTextWidth).length;
  const hasLabel = msg.role === 'user' || msg.type === 'text' || msg.type === 'tool' || msg.type === 'thought' || msg.type === 'error';
  const labelLines = hasLabel ? 1 : 0;
  const durationLines = msg.type === 'thought' && msg.duration ? 1 : 0;
  const paddingLines = hasLabel ? 2 : 0;
  return labelLines + contentLines + durationLines + paddingLines + 1;
}

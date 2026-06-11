import { Box, Text } from 'ink';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { fillByWidth, wrapByWidth } from './text.js';
import { Spinner } from './Spinner.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolOutput } from './ToolOutput.js';
import type { Message } from '../types.js';

export interface MessageListProps {
  messages: Message[];
  hiddenMessageCount: number;
  chatTextWidth: number;
  chatAreaWidth: number;
  height: number;
  isProcessing: boolean;
  currentResponse: string;
  showTimestamps?: boolean;
  showThinking?: boolean;
  showToolDetails?: boolean;
  sessionToggles?: {
    timestamps: boolean;
    showThinking: boolean;
    showToolDetails: boolean;
  };
}

export function MessageList({
  messages,
  hiddenMessageCount,
  chatTextWidth,
  chatAreaWidth,
  height,
  isProcessing,
  currentResponse,
  sessionToggles,
}: MessageListProps) {
  const showTimestamps = sessionToggles?.timestamps ?? false;
  const showThinking = sessionToggles?.showThinking ?? true;
  const showToolDetails = sessionToggles?.showToolDetails ?? true;

  return (
    <Box flexDirection="column" width={chatAreaWidth} height={height} paddingX={2}>
      {hiddenMessageCount > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>{hiddenMessageCount} earlier messages hidden</Text>
        </Box>
      )}
      {messages.map((msg, i) => (
        <MessageItem
          key={hiddenMessageCount + i}
          msg={msg}
          chatTextWidth={chatTextWidth}
          showTimestamps={showTimestamps}
          showThinking={showThinking}
          showToolDetails={showToolDetails}
          isStreaming={isProcessing && i === messages.length - 1 && msg.role === 'assistant'}
          isQueued={isProcessing && i === messages.length - 1 && msg.role === 'user'}
        />
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

function MessageItem({ msg, chatTextWidth, showTimestamps, showThinking, showToolDetails, isStreaming, isQueued }: {
  msg: Message;
  chatTextWidth: number;
  showTimestamps: boolean;
  showThinking: boolean;
  showToolDetails: boolean;
  isStreaming: boolean;
  isQueued: boolean;
}) {
  const timestamp = showTimestamps && msg.createdAt ? (
    <Text dimColor>{new Date(msg.createdAt).toLocaleTimeString()} </Text>
  ) : null;

  return (
    <Box key="msg" flexDirection="column" marginBottom={1}>
      {isQueued && (
        <Box>
          <Text color={TUI_THEME.warning} bold> [QUEUED]</Text>
        </Box>
      )}
      {msg.role === 'user' && (
        <Box flexDirection="column">
          <Box>
            {timestamp}
            <Text dimColor>User</Text>
          </Box>
          <Text backgroundColor={TUI_THEME.panel}>{fillByWidth('', chatTextWidth + 2)}</Text>
          {wrapByWidth(msg.content, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex} color="white" backgroundColor={TUI_THEME.panel}> {fillByWidth(line, chatTextWidth)} </Text>
          ))}
          <Text backgroundColor={TUI_THEME.panel}>{fillByWidth('', chatTextWidth + 2)}</Text>
        </Box>
      )}
      {msg.role === 'assistant' && msg.type === 'thought' && showThinking && (
        <Box flexDirection="column">
          <ThinkingBlock
            content={msg.content}
            duration={msg.duration ? parseInt(msg.duration) : undefined}
            width={chatTextWidth}
            collapsed={true}
            isStreaming={isStreaming}
          />
        </Box>
      )}
      {msg.role === 'assistant' && msg.type === 'thought' && !showThinking && (
        <Box flexDirection="column">
          <Text dimColor>💭 Thinking (hidden)</Text>
        </Box>
      )}
      {msg.role === 'assistant' && msg.type === 'tool' && showToolDetails && (
        <Box flexDirection="column">
          <ToolOutput
            tool={{
              id: msg.toolName || 'unknown',
              name: msg.toolName || 'unknown',
              category: 'other',
              output: msg.content,
              status: 'completed',
            }}
            width={chatTextWidth}
            collapsed={false}
          />
        </Box>
      )}
      {msg.role === 'assistant' && msg.type === 'tool' && !showToolDetails && (
        <Box flexDirection="column">
          <Text dimColor>Tool {TUI_GLYPHS.bullet} {msg.toolName}</Text>
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
          <Box>
            {timestamp}
            <Text color={TUI_THEME.accent}>MiniAgent</Text>
          </Box>
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
  const durationLines = msg.type === 'thought' ? 4 : 0; // ThinkingBlock header + collapse hint
  const paddingLines = hasLabel ? 2 : 0;
  return labelLines + contentLines + durationLines + paddingLines + 1;
}

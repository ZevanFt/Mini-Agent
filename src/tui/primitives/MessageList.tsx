import { Box, Text } from 'ink';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { wrapByWidth } from './text.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolOutput } from './ToolOutput.js';
import type { Message } from '../types.js';

const STREAMING_MAX_LINES = 8;

export interface MessageListProps {
  messages: Message[];
  hiddenMessageCount: number;
  chatTextWidth: number;
  chatAreaWidth: number;
  height: number;
  isProcessing: boolean;
  currentResponse: string;
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

  // 流式响应的可见行数
  const streamingLines = currentResponse
    ? wrapByWidth(currentResponse, chatTextWidth).slice(-STREAMING_MAX_LINES)
    : [];

  return (
    <Box flexDirection="column" width={chatAreaWidth} height={height} paddingX={2}>
      {hiddenMessageCount > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>{hiddenMessageCount} earlier messages hidden</Text>
        </Box>
      )}
      {/* 消息列表 + 流式响应：自然流动，不给固定高度 */}
      {messages.map((msg, i) => (
        <MessageItem
          key={hiddenMessageCount + i}
          msg={msg}
          chatTextWidth={chatTextWidth}
          showTimestamps={showTimestamps}
          showThinking={showThinking}
          showToolDetails={showToolDetails}
          isStreaming={false}
          isQueued={false}
        />
      ))}
      {/* 流式响应：紧跟最后一条消息 */}
      {isProcessing && (
        <Box flexDirection="column">
          {streamingLines.map((line, lineIndex) => (
            <Text key={lineIndex}>{line}</Text>
          ))}
          {!currentResponse && (
            <Text dimColor>Waiting for response...</Text>
          )}
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
  return (
    <Box key="msg" flexDirection="column" marginBottom={1}>
      {isQueued && (
        <Box>
          <Text color={TUI_THEME.warning} bold>[QUEUED]</Text>
        </Box>
      )}
      {msg.role === 'user' && (
        <Box flexDirection="column">
          <Box>
            {showTimestamps && msg.createdAt && <Text dimColor>{new Date(msg.createdAt).toLocaleTimeString()} </Text>}
            <Text color={TUI_THEME.muted}>You</Text>
          </Box>
          {wrapByWidth(msg.content, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex}>{line}</Text>
          ))}
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
          <Text dimColor>Thinking (hidden)</Text>
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
          <Text dimColor>{TUI_GLYPHS.bullet} {msg.toolName}</Text>
        </Box>
      )}
      {msg.role === 'assistant' && msg.type === 'error' && (
        <Box flexDirection="column">
          <Text color={TUI_THEME.error}>Error</Text>
          {wrapByWidth(msg.content, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex} color={TUI_THEME.error}>{line}</Text>
          ))}
        </Box>
      )}
      {msg.role === 'assistant' && (msg.type === 'text' || !msg.type) && (
        <Box flexDirection="column">
          <Box>
            {showTimestamps && msg.createdAt && <Text dimColor>{new Date(msg.createdAt).toLocaleTimeString()} </Text>}
            <Text color={TUI_THEME.accent}>MiniAgent</Text>
          </Box>
          {wrapByWidth(msg.content, chatTextWidth).map((line, lineIndex) => (
            <Text key={lineIndex}>{line}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function messageLineCount(msg: Message, chatTextWidth: number): number {
  const contentLines = wrapByWidth(msg.content, chatTextWidth).length;
  const hasLabel = msg.role === 'user' || msg.type === 'text' || msg.type === 'tool' || msg.type === 'thought' || msg.type === 'error';
  const labelLines = hasLabel ? 1 : 0;
  return contentLines + labelLines + 1;
}

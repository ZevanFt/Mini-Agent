import { Box, Text } from 'ink';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { wrapByWidth } from './text.js';
import { Spinner } from './Spinner.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ToolOutput } from './ToolOutput.js';
import type { Message } from '../types.js';

const STREAMING_ZONE_LINES = 10;

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

  // Fixed分区：流式输出区永远占 STREAMING_ZONE_LINES 行（有/无内容都一样）
  // 消息历史区 = 总高度 - 流式区 - 顶部提示行
  const headerLines = hiddenMessageCount > 0 ? 2 : 0;
  const historyHeight = Math.max(4, height - STREAMING_ZONE_LINES - headerLines);

  return (
    <Box flexDirection="column" width={chatAreaWidth} height={height} paddingX={2}>
      {hiddenMessageCount > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>{hiddenMessageCount} earlier messages hidden</Text>
        </Box>
      )}
      {/* 消息历史区：固定高度，内容超出时自动截断上方 */}
      <Box flexDirection="column" height={historyHeight}>
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
      </Box>
      {/* 流式输出区：固定高度，永不变化 */}
      <Box flexDirection="column" height={STREAMING_ZONE_LINES}>
        {isProcessing && (
          <>
            <Box>
              <Text color={TUI_THEME.accent}>MiniAgent </Text>
              <Spinner color={TUI_THEME.accent} />
              {currentResponse && <Text dimColor> ({currentResponse.length} chars)</Text>}
            </Box>
            {currentResponse ? (
              wrapByWidth(currentResponse, chatTextWidth)
                .slice(-(STREAMING_ZONE_LINES - 2))
                .map((line, lineIndex) => (
                  <Text key={lineIndex}>{line}</Text>
                ))
            ) : (
              <Text dimColor>Waiting for response...</Text>
            )}
          </>
        )}
      </Box>
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

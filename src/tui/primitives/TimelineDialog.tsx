import { Box, Text } from 'ink';
import { DialogFrame, DialogHeader } from './DialogFrame.js';
import { getScrollWindow, scrollHint } from './ScrollWindow.js';
import { TUI_GLYPHS, TUI_THEME } from './theme.js';
import { fillByWidth, truncateByWidth, wrapByWidth } from './text.js';
import type { Message } from '../types.js';

export interface TimelineDialogProps {
  messages: Message[];
  timelineIndex: number;
  timelineDetail: boolean;
  timelineDetailOffset: number;
  termWidth: number;
  termHeight: number;
}

export function TimelineDialog({
  messages,
  timelineIndex,
  timelineDetail,
  timelineDetailOffset,
  termWidth,
  termHeight,
}: TimelineDialogProps) {
  const timelineWindowSize = 12;
  const timelineWindow = getScrollWindow(messages, timelineIndex, timelineWindowSize);
  const timelineScrollHint = scrollHint(timelineWindow.hasMoreAbove, timelineWindow.hasMoreBelow);
  const selectedTimelineMessage = messages[timelineIndex];
  const timelineRows = timelineWindow.items.map((msg, i) => {
    const messageIndex = timelineWindow.start + i;
    const absoluteIndex = messageIndex + 1;
    const label = msg.role === 'user'
      ? 'User'
      : msg.type === 'error'
        ? 'Error'
        : msg.type === 'tool'
          ? `Tool ${msg.toolName || ''}`.trim()
          : 'MiniAgent';
    const preview = msg.content.replace(/\s+/g, ' ').trim();
    return { index: messageIndex, text: `${absoluteIndex}. ${label} ${TUI_GLYPHS.bullet} ${preview}` };
  });
  const detailWidth = Math.min(termWidth - 14, 66);
  const detailHeight = 14;
  const detailLines = selectedTimelineMessage ? wrapByWidth(selectedTimelineMessage.content, detailWidth) : [];
  const detailMaxOffset = Math.max(0, detailLines.length - detailHeight);
  const detailOffset = Math.min(timelineDetailOffset, detailMaxOffset);
  const detailVisibleLines = detailLines.slice(detailOffset, detailOffset + detailHeight);
  const detailScrollHint = scrollHint(detailOffset > 0, detailOffset < detailMaxOffset);

  return (
    <DialogFrame termWidth={termWidth} termHeight={termHeight} width={72}>
      <DialogHeader
        title="Session Timeline"
        meta={messages.length > 0 ? `${timelineScrollHint} ${timelineIndex + 1}/${messages.length}` : '0 messages'}
      />
      <Box marginTop={1} flexDirection="column">
        {timelineDetail && selectedTimelineMessage ? (
          <Box flexDirection="column">
            <Text color={TUI_THEME.warning}>
              {selectedTimelineMessage.role === 'user' ? 'User' : selectedTimelineMessage.type === 'error' ? 'MiniAgent Error' : 'MiniAgent'} #{timelineIndex + 1}
            </Text>
            <Text>{''}</Text>
            {detailVisibleLines.map((line, i) => (
              <Text key={`timeline-detail-${i}`}>{line}</Text>
            ))}
          </Box>
        ) : timelineRows.length === 0 ? (
          <Text dimColor>No messages yet</Text>
        ) : timelineRows.map((row) => (
          <Text
            key={`timeline-${row.index}`}
            color={row.index === timelineIndex ? 'white' : undefined}
            backgroundColor={row.index === timelineIndex ? TUI_THEME.selected : undefined}
          >
            {fillByWidth(`${row.index === timelineIndex ? TUI_GLYPHS.selected : ' '} ${truncateByWidth(row.text, Math.min(termWidth - 18, 62)).text}`, Math.min(termWidth - 14, 66))}
          </Text>
        ))}
      </Box>
      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>{timelineDetail ? `${detailScrollHint} scroll  C copy  I insert  F fork` : '↑↓ move  Home/End  Enter detail  C copy'}</Text>
        <Text dimColor>{timelineDetail ? 'R retry  U undo  Esc back' : 'I insert  R retry  F fork  U undo  Esc close'}</Text>
      </Box>
    </DialogFrame>
  );
}

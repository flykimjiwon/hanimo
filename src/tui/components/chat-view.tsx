import React, { useMemo, useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from './spinner.js';
import { colors } from '../theme.js';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool-call' | 'tool-result' | 'system';
  content: string;
  toolName?: string;
}

interface ChatViewProps {
  messages: DisplayMessage[];
  streamingText: string;
  isLoading: boolean;
  height: number;
  verbose?: boolean;
}

const COMPACT_LINES = 10;
const VERBOSE_LINES = 500;

function truncateLines(
  text: string,
  maxLines: number,
): { text: string; hidden: number } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return { text, hidden: 0 };
  const kept = lines.slice(0, maxLines);
  const hidden = lines.length - maxLines;
  return { text: kept.join('\n'), hidden };
}

/** Memoized message bubble — avoids re-rendering unchanged messages */
const MessageBubble = React.memo(function MessageBubble({
  message,
  maxToolLines,
}: {
  message: DisplayMessage;
  maxToolLines: number;
}): React.ReactElement {
  switch (message.role) {
    case 'user':
      return (
        <Box paddingX={1}>
          <Text color={colors.userText} bold>
            {'\u276F'}{' '}
          </Text>
          <Text color={colors.userText}>{message.content}</Text>
        </Box>
      );

    case 'assistant':
      return (
        <Box paddingX={1} flexDirection="column">
          <Text color={colors.assistantText}>{message.content}</Text>
        </Box>
      );

    case 'tool-call':
      return (
        <Box paddingX={1}>
          <Text color={colors.toolCall}>
            {'\u26A1'} {message.toolName ?? 'tool'}
          </Text>
        </Box>
      );

    case 'tool-result': {
      const { text: truncated, hidden } = truncateLines(
        message.content,
        maxToolLines,
      );
      const isError = message.content.startsWith('Error:');
      return (
        <Box paddingX={1} flexDirection="column">
          <Text color={colors.toolCall} dimColor>
            {'\u2514'} {message.toolName ?? 'tool'}
          </Text>
          <Box paddingLeft={2} flexDirection="column">
            <Text color={isError ? colors.error : colors.toolResult}>
              {truncated}
            </Text>
            {hidden > 0 && (
              <Text color={colors.dimText}>
                {'\u2501\u2501'} {hidden} more lines (Ctrl+O verbose){' '}
                {'\u2501\u2501'}
              </Text>
            )}
          </Box>
        </Box>
      );
    }

    case 'system':
      return (
        <Box paddingX={1} flexDirection="column">
          <Text color={colors.hint}>{message.content}</Text>
        </Box>
      );

    default: {
      const _exhaustive: never = message.role;
      return <Text>{String(_exhaustive)}</Text>;
    }
  }
});

function estimateLines(
  msg: DisplayMessage,
  width: number,
  maxToolLines: number,
): number {
  const usableWidth = Math.max(width - 4, 20);
  const content =
    msg.role === 'tool-result'
      ? truncateLines(msg.content, maxToolLines).text
      : msg.content;
  let lines = 0;
  for (const line of content.split('\n')) {
    lines += Math.max(1, Math.ceil(line.length / usableWidth));
  }
  if (msg.role === 'user') lines += 1;
  if (
    msg.role === 'tool-result' &&
    msg.content.split('\n').length > maxToolLines
  ) {
    lines += 1;
  }
  return lines;
}

export const ChatView = React.memo(function ChatView({
  messages,
  streamingText,
  isLoading,
  height,
  verbose = false,
}: ChatViewProps): React.ReactElement {
  const width = process.stdout.columns || 80;
  const maxToolLines = verbose ? VERBOSE_LINES : COMPACT_LINES;

  // Scroll state: 0 = bottom (latest), positive = scrolled up by N messages
  const [scrollOffset, setScrollOffset] = useState(0);

  // Auto-scroll to bottom on new messages
  const msgCount = messages.length;
  useEffect(() => {
    setScrollOffset(0);
  }, [msgCount]);

  // Auto-scroll when streaming starts
  const isStreaming = streamingText.length > 0;
  useEffect(() => {
    if (isStreaming) setScrollOffset(0);
  }, [isStreaming]);

  // Scroll with Shift+Up/Down or Alt+Up/Down
  useInput((_input, key) => {
    if (key.upArrow && (key.meta || key.shift)) {
      setScrollOffset((prev) =>
        Math.min(prev + 3, Math.max(0, messages.length - 1)),
      );
    }
    if (key.downArrow && (key.meta || key.shift)) {
      setScrollOffset((prev) => Math.max(prev - 3, 0));
    }
  });

  const visibleMessages = useMemo(() => {
    let reserved = 0;
    if (isStreaming) {
      for (const line of streamingText.split('\n')) {
        reserved += Math.max(
          1,
          Math.ceil(line.length / Math.max(width - 4, 20)),
        );
      }
    }
    if (isLoading && !isStreaming) reserved = 1;
    if (scrollOffset > 0) reserved += 1;

    const available = height - reserved;
    if (available <= 0) return messages;

    // Apply scroll offset: skip last N messages
    const endIdx = Math.max(0, messages.length - scrollOffset);
    const subset = messages.slice(0, endIdx);

    // Walk backwards to fill the viewport
    let used = 0;
    let startIdx = subset.length;
    for (let i = subset.length - 1; i >= 0; i--) {
      const msg = subset[i];
      if (!msg) break;
      const est = estimateLines(msg, width, maxToolLines);
      if (used + est > available && startIdx < subset.length) break;
      used += est;
      startIdx = i;
    }
    return subset.slice(startIdx);
  }, [
    messages,
    streamingText,
    isLoading,
    isStreaming,
    height,
    width,
    scrollOffset,
    maxToolLines,
  ]);

  const firstVisible = visibleMessages[0];
  const hiddenAbove = firstVisible ? messages.indexOf(firstVisible) : 0;

  return (
    <Box flexDirection="column" height={height} overflowY="hidden">
      {/* Scroll-up indicator */}
      {hiddenAbove > 0 && (
        <Box paddingX={1} justifyContent="center">
          <Text color={colors.dimText}>
            {'\u2191'} {hiddenAbove} more (Shift+{'\u2191'} scroll)
          </Text>
        </Box>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <Box justifyContent="center" flexGrow={1} alignItems="center">
          <Text color={colors.dimText}>
            Type a message to start... {'\u2502'} Ctrl+C to exit
          </Text>
        </Box>
      )}

      {/* Messages — visible portion */}
      {visibleMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} maxToolLines={maxToolLines} />
      ))}

      {/* Active streaming text — truncate to fit available height */}
      {isStreaming && (
        <Box paddingX={1} flexDirection="column" height={Math.min(height - visibleMessages.length * 2, Math.max(3, height / 2))} overflowY="hidden">
          <Text color={colors.assistantText} wrap="wrap">{
            (() => {
              const maxLines = Math.max(5, Math.floor(height / 2));
              const lines = streamingText.split('\n');
              if (lines.length <= maxLines) return streamingText;
              return lines.slice(-maxLines).join('\n');
            })()
          }</Text>
        </Box>
      )}

      {/* Thinking indicator */}
      {isLoading && !isStreaming && (
        <Box paddingX={1}>
          <Spinner label="Thinking..." color={colors.statusThinking} />
        </Box>
      )}

      {/* Scroll-down indicator */}
      {scrollOffset > 0 && (
        <Box paddingX={1} justifyContent="center">
          <Text color={colors.dimText}>
            {'\u2193'} {scrollOffset} below (Shift+{'\u2193'} scroll)
          </Text>
        </Box>
      )}
    </Box>
  );
})

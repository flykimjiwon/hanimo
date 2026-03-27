import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
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
}

const MAX_TOOL_RESULT_LINES = 10;

function truncateLines(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  const kept = lines.slice(0, maxLines);
  const remaining = lines.length - maxLines;
  return kept.join('\n') + `\n... (${remaining} more lines)`;
}

function MessageBubble({ message }: { message: DisplayMessage }): React.ReactElement {
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
      const truncated = truncateLines(message.content, MAX_TOOL_RESULT_LINES);
      const isError = message.content.startsWith('Error:');
      return (
        <Box paddingX={1} flexDirection="column">
          <Text color={colors.toolCall} dimColor>
            {'\u2514'} {message.toolName ?? 'tool'}
          </Text>
          <Box paddingLeft={2}>
            <Text color={isError ? colors.error : colors.toolResult}>
              {truncated}
            </Text>
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
}

// Estimate how many terminal lines a message takes
function estimateLines(msg: DisplayMessage, width: number): number {
  const usableWidth = Math.max(width - 4, 20); // padding
  const text = msg.role === 'tool-result'
    ? truncateLines(msg.content, MAX_TOOL_RESULT_LINES)
    : msg.content;
  let lines = 0;
  for (const line of text.split('\n')) {
    lines += Math.max(1, Math.ceil(line.length / usableWidth));
  }
  // user messages get extra top margin (1 line)
  if (msg.role === 'user') lines += 1;
  return lines;
}

export function ChatView({
  messages,
  streamingText,
  isLoading,
  height,
}: ChatViewProps): React.ReactElement {
  const width = process.stdout.columns || 80;

  // Calculate which messages fit in the viewport (show most recent)
  const visibleMessages = useMemo(() => {
    // Reserve lines for streaming text and spinner
    let reserved = 0;
    if (streamingText.length > 0) {
      for (const line of streamingText.split('\n')) {
        reserved += Math.max(1, Math.ceil(line.length / Math.max(width - 4, 20)));
      }
    }
    if (isLoading && streamingText.length === 0) {
      reserved = 1; // spinner line
    }

    const available = height - reserved;
    if (available <= 0) return messages;

    let used = 0;
    let startIdx = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) break;
      const lines = estimateLines(msg, width);
      if (used + lines > available && startIdx < messages.length) break;
      used += lines;
      startIdx = i;
    }
    return messages.slice(startIdx);
  }, [messages, streamingText, isLoading, height, width]);

  return (
    <Box flexDirection="column" height={height}>
      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <Box justifyContent="center" flexGrow={1} alignItems="center">
          <Text color={colors.dimText}>
            Type a message to start... {'\u2502'} Ctrl+C to exit
          </Text>
        </Box>
      )}

      {/* Messages — only visible portion */}
      {visibleMessages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Active streaming text */}
      {streamingText.length > 0 && (
        <Box paddingX={1} flexDirection="column">
          <Text color={colors.assistantText}>{streamingText}</Text>
        </Box>
      )}

      {/* Thinking indicator */}
      {isLoading && streamingText.length === 0 && (
        <Box paddingX={1}>
          <Spinner label="Thinking..." color={colors.statusThinking} />
        </Box>
      )}
    </Box>
  );
}

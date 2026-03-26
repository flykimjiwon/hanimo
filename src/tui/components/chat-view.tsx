import React from 'react';
import { Box, Text, Static } from 'ink';
import { Spinner } from './spinner.js';
import { colors } from '../theme.js';

export interface DisplayMessage {
  role: 'user' | 'assistant' | 'tool-call' | 'tool-result';
  content: string;
  toolName?: string;
}

interface ChatViewProps {
  messages: DisplayMessage[];
  streamingText: string;
  isLoading: boolean;
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
        <Box marginTop={1} paddingX={1}>
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
  }
}

export function ChatView({
  messages,
  streamingText,
  isLoading,
}: ChatViewProps): React.ReactElement {
  // Split: completed messages go to <Static>, active goes to live render
  const completedMessages = streamingText.length > 0 || isLoading
    ? messages.slice(0, -0 || messages.length) // all completed when streaming
    : messages;

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      {/* Completed messages — never re-rendered */}
      <Static items={completedMessages}>
        {(msg, index) => (
          <MessageBubble key={index} message={msg} />
        )}
      </Static>

      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <Box justifyContent="center" marginY={1} paddingX={1}>
          <Text color={colors.dimText}>
            Type a message to start... {'\u2502'} Ctrl+C to exit
          </Text>
        </Box>
      )}

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

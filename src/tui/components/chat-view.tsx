import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './spinner.js';

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
        <Box marginY={0}>
          <Text color="cyan" bold>
            You:{' '}
          </Text>
          <Text color="cyan">{message.content}</Text>
        </Box>
      );

    case 'assistant':
      return (
        <Box marginY={0} flexDirection="column">
          <Text color="white">{message.content}</Text>
        </Box>
      );

    case 'tool-call':
      return (
        <Box marginY={0}>
          <Text dimColor>
            {'\u26A1'} Calling {message.toolName ?? 'tool'}...
          </Text>
        </Box>
      );

    case 'tool-result': {
      const truncated = truncateLines(message.content, MAX_TOOL_RESULT_LINES);
      const isError = message.content.startsWith('Error:');
      return (
        <Box marginY={0} flexDirection="column">
          <Text dimColor bold>
            {'\u2500'} {message.toolName ?? 'tool'} result:
          </Text>
          <Text color={isError ? 'red' : 'gray'}>{truncated}</Text>
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
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
      {messages.length === 0 && !isLoading && (
        <Box justifyContent="center" marginY={1}>
          <Text dimColor>Type a message to start...</Text>
        </Box>
      )}

      {messages.map((msg, index) => (
        <MessageBubble key={index} message={msg} />
      ))}

      {streamingText.length > 0 && (
        <Box marginY={0} flexDirection="column">
          <Text color="white">{streamingText}</Text>
        </Box>
      )}

      {isLoading && streamingText.length === 0 && (
        <Box marginY={0}>
          <Spinner label="Thinking..." />
        </Box>
      )}
    </Box>
  );
}

import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './spinner.js';

type StatusKind = 'idle' | 'thinking' | 'tool';

interface StatusBarProps {
  provider: string;
  model: string;
  status: StatusKind;
  currentTool?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function StatusIndicator({
  status,
  currentTool,
}: {
  status: StatusKind;
  currentTool?: string;
}): React.ReactElement {
  switch (status) {
    case 'idle':
      return <Text color="green">Ready</Text>;
    case 'thinking':
      return <Spinner label="Thinking..." />;
    case 'tool':
      return <Spinner label={currentTool ? `Running ${currentTool}` : 'Running tool...'} />;
  }
}

export function StatusBar({
  provider,
  model,
  status,
  currentTool,
  usage,
}: StatusBarProps): React.ReactElement {
  const totalTokens = usage.promptTokens + usage.completionTokens;

  return (
    <Box
      width="100%"
      justifyContent="space-between"
      paddingX={1}
    >
      <Box>
        <Text bold color="blue">
          devany
        </Text>
        <Text dimColor> | </Text>
        <Text color="white">
          {provider}/{model}
        </Text>
      </Box>

      <Box>
        <StatusIndicator status={status} currentTool={currentTool} />
      </Box>

      <Box>
        <Text dimColor>
          {formatTokens(totalTokens)} tokens
        </Text>
        <Text dimColor> | </Text>
        <Text color="yellow">{formatCost(usage.totalCost)}</Text>
      </Box>
    </Box>
  );
}

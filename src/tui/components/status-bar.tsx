import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './spinner.js';
import { colors } from '../theme.js';

type StatusKind = 'idle' | 'thinking' | 'tool';

interface StatusBarProps {
  provider: string;
  model: string;
  status: StatusKind;
  currentTool?: string;
  toolsEnabled: boolean;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
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
      return <Text color={colors.statusIdle}>{'\u25CF'} Ready</Text>;
    case 'thinking':
      return <Spinner label="Thinking..." color={colors.statusThinking} />;
    case 'tool':
      return <Spinner label={currentTool ? `${currentTool}` : 'tool...'} color={colors.statusTool} />;
  }
}

export function StatusBar({
  provider,
  model,
  status,
  currentTool,
  toolsEnabled,
  usage,
}: StatusBarProps): React.ReactElement {
  const totalTokens = usage.promptTokens + usage.completionTokens;
  const toolsTag = toolsEnabled ? 'tools:ON' : 'tools:OFF';
  const toolsColor = toolsEnabled ? colors.success : colors.dimText;

  return (
    <Box flexDirection="column" width="100%">
      <Box
        width="100%"
        justifyContent="space-between"
        paddingX={1}
      >
        <Box>
          <Text bold color={colors.model}>
            devany
          </Text>
          <Text color={colors.dimText}> {'\u2502'} </Text>
          <Text color={colors.provider}>{provider}</Text>
          <Text color={colors.dimText}>/</Text>
          <Text color={colors.model}>{model}</Text>
          <Text color={colors.dimText}> {'\u2502'} </Text>
          <Text color={toolsColor}>{toolsTag}</Text>
        </Box>

        <Box>
          <StatusIndicator status={status} currentTool={currentTool} />
        </Box>

        <Box>
          <Text color={colors.dimText}>
            {formatTokens(totalTokens)} tok
          </Text>
          <Text color={colors.dimText}> {'\u2502'} </Text>
          <Text color={colors.cost}>{formatCost(usage.totalCost)}</Text>
        </Box>
      </Box>
      <Box width="100%">
        <Text color={colors.border}>
          {'\u2500'.repeat(process.stdout.columns || 80)}
        </Text>
      </Box>
    </Box>
  );
}

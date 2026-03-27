import React from 'react';
import { Box, Text } from 'ink';
import { Spinner } from './spinner.js';
import { colors } from '../theme.js';
import type { ModelRole } from '../../providers/model-capabilities.js';
import { ROLE_BADGES } from '../../providers/model-capabilities.js';

type StatusKind = 'idle' | 'thinking' | 'tool';

interface StatusBarProps {
  provider: string;
  model: string;
  modelRole: ModelRole;
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
  const n = Number.isFinite(count) ? count : 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
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

export const StatusBar = React.memo(function StatusBar({
  provider,
  model,
  modelRole,
  status,
  currentTool,
  toolsEnabled,
  usage,
}: StatusBarProps): React.ReactElement {
  const totalTokens = usage.promptTokens + usage.completionTokens;
  const toolsTag = toolsEnabled ? 'tools:ON' : 'tools:OFF';
  const toolsColor = toolsEnabled ? colors.success : colors.dimText;

  // Role badge colors: Agent=green, Assistant=yellow, Chat=gray
  const roleBadge = ROLE_BADGES[modelRole];
  const roleColor = modelRole === 'agent' ? colors.success
    : modelRole === 'assistant' ? colors.warning
    : colors.dimText;

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
          <Text> </Text>
          <Text color={roleColor} bold>{roleBadge}</Text>
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
});

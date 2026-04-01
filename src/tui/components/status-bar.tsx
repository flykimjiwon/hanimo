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
  roleIcon?: string;
  roleName?: string;
  subAgentStatus?: string;
  elapsedMs?: number;
  verbose?: boolean;
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

function formatElapsed(ms: number): string {
  if (ms <= 0) return '';
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remainSec = Math.floor(sec % 60);
  return `${min}m${remainSec}s`;
}

function StatusIndicator({
  status,
  currentTool,
  elapsedMs,
}: {
  status: StatusKind;
  currentTool?: string;
  elapsedMs?: number;
}): React.ReactElement {
  const elapsed = elapsedMs && elapsedMs > 0 ? ` ${formatElapsed(elapsedMs)}` : '';

  switch (status) {
    case 'idle':
      return <Text color={colors.statusIdle}>{'\u25CF'} Ready</Text>;
    case 'thinking':
      return <Spinner label={`Thinking...${elapsed}`} color={colors.statusThinking} />;
    case 'tool':
      return (
        <Spinner
          label={`${currentTool ? currentTool : 'tool...'}${elapsed}`}
          color={colors.statusTool}
        />
      );
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
  roleIcon,
  roleName,
  subAgentStatus,
  elapsedMs,
  verbose,
}: StatusBarProps): React.ReactElement {
  const totalTokens = usage.promptTokens + usage.completionTokens;
  const isReadOnly = toolsEnabled && roleName?.toLowerCase() === 'plan';
  const toolsTag = isReadOnly ? 'tools:READ' : toolsEnabled ? 'tools:ON' : 'tools:OFF';
  const toolsColor = isReadOnly ? colors.warning : toolsEnabled ? colors.success : colors.dimText;

  // Role display: use role icon+name if available, otherwise model capability badge
  const roleDisplay = roleIcon && roleName
    ? `${roleIcon} ${roleName}`
    : ROLE_BADGES[modelRole];
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
            hanimo
          </Text>
          <Text color={colors.dimText}> {'\u2502'} </Text>
          <Text color={colors.provider}>{provider}</Text>
          <Text color={colors.dimText}>/</Text>
          <Text color={colors.model}>{model}</Text>
          <Text> </Text>
          <Text color={roleColor} bold>{roleDisplay}</Text>
          <Text color={colors.dimText}> {'\u2502'} </Text>
          <Text color={toolsColor}>{toolsTag}</Text>
          {verbose && (
            <>
              <Text color={colors.dimText}> {'\u2502'} </Text>
              <Text color={colors.warning}>verbose</Text>
            </>
          )}
          {subAgentStatus ? (
            <>
              <Text color={colors.dimText}> {'\u2502'} </Text>
              <Text color={colors.statusThinking}>{subAgentStatus}</Text>
            </>
          ) : null}
        </Box>

        <Box>
          <StatusIndicator status={status} currentTool={currentTool} elapsedMs={elapsedMs} />
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

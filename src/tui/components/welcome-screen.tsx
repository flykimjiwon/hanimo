import React from 'react';
import { Box, Text } from 'ink';
import { Banner } from './banner.js';
import { NotifyInline } from './notify-box.js';
import { colors } from '../theme.js';

interface WelcomeScreenProps {
  provider: string;
  model: string;
  roleIcon?: string;
  roleName?: string;
  cols?: number;
  height?: number;
  themeId?: string;
  tips?: string[];
  notifications?: Array<{ type: 'info' | 'warning' | 'success' | 'error'; title?: string; message: string }>;
}

const DEFAULT_TIPS = [
  '\uD504\uB86C\uD504\uD2B8\uB97C \uC785\uB825\uD558\uBA74 \uB300\uD654\uAC00 \uC2DC\uC791\uB429\uB2C8\uB2E4',
];

export const WelcomeScreen = React.memo(function WelcomeScreen({
  provider,
  model,
  roleIcon,
  roleName,
  cols = 80,
  height,
  themeId,
  tips,
  notifications,
}: WelcomeScreenProps): React.ReactElement {
  const displayTips = tips ?? DEFAULT_TIPS;

  return (
    <Box flexDirection="column" width="100%" height={height} justifyContent="center" alignItems="center">
      <Banner cols={cols} themeId={themeId} />

      {/* Provider/model info — compact single line */}
      <Box justifyContent="center" width="100%" marginTop={1}>
        <Text color={colors.dimText}>{'\u2500\u2500\u2500'} </Text>
        <Text color={colors.provider} bold>{provider}</Text>
        <Text color={colors.dimText}>/</Text>
        <Text color={colors.model} bold>{model}</Text>
        {roleIcon && roleName && (
          <>
            <Text color={colors.dimText}>  {'\u00B7'}  </Text>
            <Text color={colors.success}>{roleIcon} {roleName}</Text>
          </>
        )}
        <Text color={colors.dimText}> {'\u2500\u2500\u2500'}</Text>
      </Box>

      {/* Notifications */}
      {notifications && notifications.length > 0 && (
        <Box flexDirection="column" marginTop={1} alignItems="center" width="100%">
          {notifications.map((n, i) => (
            <Box key={i} justifyContent="center" width="100%">
              <Text color={n.type === 'warning' ? colors.warning : n.type === 'error' ? colors.error : colors.hint}>
                {n.type === 'warning' ? '\u26A0' : n.type === 'error' ? '\u2718' : '\u2139'} {n.title ? `${n.title}: ` : ''}{n.message}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Notifications only — tips and start prompt removed for cleaner look */}
    </Box>
  );
});

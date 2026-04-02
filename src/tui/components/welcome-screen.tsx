import React from 'react';
import { Box, Text } from 'ink';
import { Banner } from './banner.js';
import { NotifyBox, NotifyInline } from './notify-box.js';
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
  'Enter \uC804\uC1A1  |  Esc \uBA54\uB274  |  Ctrl+K \uD314\uB808\uD2B8  |  /help \uB3C4\uC6C0\uB9D0',
  'Tab \uC5ED\uD560 \uC804\uD658  |  Ctrl+X \uB9AC\uB354\uD0A4  |  /theme \uD14C\uB9C8 \uBCC0\uACBD',
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
  // Constrain notification box width to terminal width
  const boxWidth = Math.min(cols - 4, 70);

  return (
    <Box flexDirection="column" width="100%" height={height} alignItems="center">
      <Banner version="0.1.0" tagline={'\uD130\uBBF8\uB110 AI \uCF54\uB529 \uC5B4\uC2DC\uC2A4\uD134\uD2B8'} cols={cols} themeId={themeId} />

      {/* Provider/model info */}
      <Box justifyContent="center" width="100%" marginTop={1}>
        <Text color={colors.dimText}>{'\u250C'}{'\u2500'.repeat(boxWidth - 2)}{'\u2510'}</Text>
      </Box>
      <Box justifyContent="center" width="100%">
        <Text color={colors.dimText}>{'\u2502'} </Text>
        <Text color={colors.provider} bold>{provider}</Text>
        <Text color={colors.dimText}>/</Text>
        <Text color={colors.model} bold>{model}</Text>
        {roleIcon && roleName && (
          <>
            <Text color={colors.dimText}>  {'\u2502'}  </Text>
            <Text color={colors.success}>{roleIcon} {roleName}</Text>
          </>
        )}
        <Text>{' '.repeat(Math.max(1, boxWidth - provider.length - model.length - (roleIcon && roleName ? roleName.length + 8 : 0) - 5))}</Text>
        <Text color={colors.dimText}>{'\u2502'}</Text>
      </Box>
      <Box justifyContent="center" width="100%">
        <Text color={colors.dimText}>{'\u2514'}{'\u2500'.repeat(boxWidth - 2)}{'\u2518'}</Text>
      </Box>

      {/* Notifications */}
      {notifications && notifications.length > 0 && (
        <Box flexDirection="column" marginTop={1} width={boxWidth + 2} alignItems="center">
          {notifications.map((n, i) => (
            <NotifyBox key={i} type={n.type} title={n.title} width={boxWidth}>
              {n.message}
            </NotifyBox>
          ))}
        </Box>
      )}

      {/* Tips */}
      <Box flexDirection="column" marginTop={1} alignItems="center" width="100%">
        {displayTips.map((tip, i) => (
          <NotifyInline key={i} type="tip">
            <Text color={colors.hint}>{tip}</Text>
          </NotifyInline>
        ))}
      </Box>

      {/* Start prompt */}
      <Box justifyContent="center" width="100%" marginTop={1}>
        <Text color={colors.dimText} italic>
          {'\uD504\uB86C\uD504\uD2B8\uB97C \uC785\uB825\uD558\uBA74 \uB300\uD654\uAC00 \uC2DC\uC791\uB429\uB2C8\uB2E4...'}
        </Text>
      </Box>
    </Box>
  );
});

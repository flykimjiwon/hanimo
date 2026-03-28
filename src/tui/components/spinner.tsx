import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
const INTERVAL_MS = 200;

interface SpinnerProps {
  label?: string;
  color?: string;
}

export function Spinner({ label, color = 'cyan' }: SpinnerProps): React.ReactElement {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % FRAMES.length);
    }, INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const frame = FRAMES[frameIndex] ?? FRAMES[0];

  return (
    <Text>
      <Text color={color}>{frame}</Text>
      {label ? <Text> {label}</Text> : null}
    </Text>
  );
}

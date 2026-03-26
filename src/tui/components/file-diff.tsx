import React from 'react';
import { Box, Text } from 'ink';

interface FileDiffProps {
  diff: string;
  filePath: string;
}

function classifyLine(line: string): 'added' | 'removed' | 'hunk' | 'context' {
  if (line.startsWith('+')) return 'added';
  if (line.startsWith('-')) return 'removed';
  if (line.startsWith('@')) return 'hunk';
  return 'context';
}

function DiffLine({ line }: { line: string }): React.ReactElement {
  const kind = classifyLine(line);

  switch (kind) {
    case 'added':
      return <Text color="green">{line}</Text>;
    case 'removed':
      return <Text color="red">{line}</Text>;
    case 'hunk':
      return <Text color="cyan">{line}</Text>;
    case 'context':
      return <Text dimColor>{line}</Text>;
  }
}

export function FileDiff({ diff, filePath }: FileDiffProps): React.ReactElement {
  const lines = diff.split('\n');

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        {filePath}
      </Text>
      {lines.map((line, index) => (
        <DiffLine key={index} line={line} />
      ))}
    </Box>
  );
}

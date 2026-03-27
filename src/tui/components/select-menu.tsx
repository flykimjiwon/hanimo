import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

export interface MenuItem {
  label: string;
  value: string;
  active?: boolean;
  badge?: string;
  badgeColor?: string;
}

interface SelectMenuProps {
  title: string;
  items: MenuItem[];
  onSelect: (value: string) => void;
  onCancel: () => void;
}

export function SelectMenu({ title, items, onSelect, onCancel }: SelectMenuProps): React.ReactElement {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setCursor((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
      return;
    }

    if (key.downArrow) {
      setCursor((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
      return;
    }

    if (key.return) {
      const item = items[cursor];
      if (item) onSelect(item.value);
      return;
    }

    // Number key shortcuts (1-9)
    const num = parseInt(input, 10);
    if (num >= 1 && num <= 9 && num <= items.length) {
      const item = items[num - 1];
      if (item) onSelect(item.value);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderFocus} paddingX={1}>
      <Text bold color={colors.model}>{title}</Text>
      <Text color={colors.dimText}>{'\u2500'.repeat(30)}</Text>
      {items.map((item, i) => {
        const isCursor = i === cursor;
        const marker = item.active ? '\u25CF' : isCursor ? '\u25B8' : ' ';
        const num = i < 9 ? `${i + 1}` : ' ';
        return (
          <Box key={item.value}>
            <Text color={isCursor ? colors.model : colors.dimText}>{num} </Text>
            <Text color={isCursor ? colors.hint : item.active ? colors.success : colors.assistantText}>
              {marker} {item.label}
            </Text>
            {item.badge && (
              <Text color={item.badgeColor ?? colors.dimText}> {item.badge}</Text>
            )}
          </Box>
        );
      })}
      <Text color={colors.dimText}>{'\u2500'.repeat(30)}</Text>
      <Text color={colors.dimText}>{'↑↓ navigate  Enter select  Esc cancel'}</Text>
    </Box>
  );
}

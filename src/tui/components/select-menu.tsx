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
  legend?: string;
  /** Called when cursor moves — use for live preview (e.g. theme) */
  onHighlight?: (value: string) => void;
}

export function SelectMenu({ title, items, onSelect, onCancel, legend, onHighlight }: SelectMenuProps): React.ReactElement {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setCursor((prev) => {
        const next = prev <= 0 ? items.length - 1 : prev - 1;
        if (onHighlight && items[next]) onHighlight(items[next].value);
        return next;
      });
      return;
    }

    if (key.downArrow) {
      setCursor((prev) => {
        const next = prev >= items.length - 1 ? 0 : prev + 1;
        if (onHighlight && items[next]) onHighlight(items[next].value);
        return next;
      });
      return;
    }

    if (key.return) {
      const item = items[cursor];
      if (item) onSelect(item.value);
      return;
    }

    // Number key shortcuts (0-9): 1-9 for items 1-9, 0 for item 10
    const num = parseInt(input, 10);
    if (!isNaN(num)) {
      const idx = num === 0 ? 9 : num - 1; // 0 key = 10th item
      if (idx >= 0 && idx < items.length) {
        const item = items[idx];
        if (item) onSelect(item.value);
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderFocus} paddingX={1}>
      <Text bold color={colors.model}>{title}</Text>
      <Text color={colors.dimText}>{'\u2500'.repeat(30)}</Text>
      {items.map((item, i) => {
        const isCursor = i === cursor;
        const marker = item.active ? '\u25CF' : isCursor ? '\u25B8' : ' ';
        const num = i < 10 ? `${(i + 1) % 10}` : ' ';
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
      {legend && <Text color={colors.dimText}>{legend}</Text>}
      <Text color={colors.dimText}>{'↑↓ navigate  Enter select  Esc cancel'}</Text>
    </Box>
  );
}

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

interface InputBarProps {
  onSubmit: (text: string) => void;
  isDisabled: boolean;
}

export function InputBar({ onSubmit, isDisabled }: InputBarProps): React.ReactElement {
  const [value, setValue] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
    setValue('');
    setCursorOffset(0);
  }, [value, onSubmit]);

  useInput(
    (input, key) => {
      if (isDisabled) return;

      if (key.return) {
        handleSubmit();
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorOffset < value.length) {
          const deletePos = value.length - cursorOffset - 1;
          setValue((prev) => prev.slice(0, deletePos) + prev.slice(deletePos + 1));
        }
        return;
      }

      if (key.leftArrow) {
        setCursorOffset((prev) => Math.min(prev + 1, value.length));
        return;
      }

      if (key.rightArrow) {
        setCursorOffset((prev) => Math.max(prev - 1, 0));
        return;
      }

      // Ignore control sequences
      if (key.ctrl || key.meta) return;
      if (key.upArrow || key.downArrow || key.tab) return;

      // Insert character at cursor position
      if (input) {
        const insertPos = value.length - cursorOffset;
        setValue((prev) => prev.slice(0, insertPos) + input + prev.slice(insertPos));
      }
    },
    { isActive: !isDisabled },
  );

  const prompt = isDisabled ? '\u23F3 ' : '\u276F ';
  const promptColor = isDisabled ? colors.promptDisabled : colors.prompt;

  return (
    <Box borderStyle="round" borderColor={isDisabled ? colors.border : colors.borderFocus} paddingX={1} width="100%">
      <Text color={promptColor}>{prompt}</Text>
      <Text color={colors.userText}>{value}</Text>
      {!isDisabled && <Text color={colors.dimText}>{'\u2588'}</Text>}
    </Box>
  );
}

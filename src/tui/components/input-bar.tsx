import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

const MAX_HISTORY = 50;

interface InputBarProps {
  onSubmit: (text: string) => void;
  isDisabled: boolean;
  /** List of completable tokens for Tab (slash commands, model names, etc.) */
  completions?: string[];
}

export function InputBar({ onSubmit, isDisabled, completions }: InputBarProps): React.ReactElement {
  const [value, setValue] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);

  // Input history
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1); // -1 = not browsing history
  const draftRef = useRef(''); // preserves current text when browsing

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;

    // Push to history (avoid duplicate of last entry)
    const history = historyRef.current;
    if (history[0] !== trimmed) {
      history.unshift(trimmed);
      if (history.length > MAX_HISTORY) history.pop();
    }
    historyIndexRef.current = -1;
    draftRef.current = '';

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

      // History navigation
      if (key.upArrow) {
        const history = historyRef.current;
        if (history.length === 0) return;
        if (historyIndexRef.current === -1) {
          draftRef.current = value; // save current draft
        }
        const nextIdx = Math.min(historyIndexRef.current + 1, history.length - 1);
        historyIndexRef.current = nextIdx;
        const entry = history[nextIdx] ?? '';
        setValue(entry);
        setCursorOffset(0);
        return;
      }

      if (key.downArrow) {
        if (historyIndexRef.current === -1) return;
        const nextIdx = historyIndexRef.current - 1;
        if (nextIdx < 0) {
          historyIndexRef.current = -1;
          setValue(draftRef.current);
          setCursorOffset(0);
          return;
        }
        historyIndexRef.current = nextIdx;
        const entry = historyRef.current[nextIdx] ?? '';
        setValue(entry);
        setCursorOffset(0);
        return;
      }

      // Tab autocomplete
      if (key.tab) {
        if (!completions || completions.length === 0 || value.length === 0) return;

        // Find the last word to complete
        const parts = value.split(' ');
        const lastPart = parts[parts.length - 1] ?? '';
        if (lastPart.length === 0) return;

        const matches = completions.filter((c) => c.startsWith(lastPart));
        if (matches.length === 1) {
          parts[parts.length - 1] = matches[0]!;
          const completed = parts.join(' ');
          setValue(completed);
          setCursorOffset(0);
        }
        return;
      }

      // Ignore control sequences
      if (key.ctrl || key.meta) return;

      // Insert character at cursor position
      if (input) {
        const insertPos = value.length - cursorOffset;
        setValue((prev) => prev.slice(0, insertPos) + input + prev.slice(insertPos));
        // Reset history browsing on new input
        if (historyIndexRef.current !== -1) {
          historyIndexRef.current = -1;
          draftRef.current = '';
        }
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

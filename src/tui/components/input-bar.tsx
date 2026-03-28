import React, { useState, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';

const MAX_HISTORY = 50;

interface InputBarProps {
  onSubmit: (text: string) => void;
  isDisabled: boolean;
  /** List of completable tokens for Tab (slash commands, model names, etc.) */
  completions?: string[];
  /** Called when Tab pressed with empty input — cycles roles */
  onCycleRole?: () => void;
  /** Current role icon (e.g. "🔧") */
  roleIcon?: string;
  /** Current role name (e.g. "Dev") */
  roleName?: string;
}

export const InputBar = React.memo(function InputBar({
  onSubmit,
  isDisabled,
  completions,
  onCycleRole,
  roleIcon,
  roleName,
}: InputBarProps): React.ReactElement {
  const [value, setValue] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);

  // Input history
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef('');

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return;

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

      // Enter: submit, or newline if value ends with backslash
      if (key.return) {
        if (value.endsWith('\\')) {
          // Remove trailing backslash, insert newline — multi-line mode
          setValue((prev) => prev.slice(0, -1) + '\n');
          setCursorOffset(0);
          return;
        }
        handleSubmit();
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorOffset < value.length) {
          const deletePos = value.length - cursorOffset - 1;
          setValue(
            (prev) => prev.slice(0, deletePos) + prev.slice(deletePos + 1),
          );
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

      // History navigation (ignore when shift/meta pressed — those are for scroll)
      if (key.upArrow && !key.meta && !key.shift) {
        const history = historyRef.current;
        if (history.length === 0) return;
        if (historyIndexRef.current === -1) {
          draftRef.current = value;
        }
        const nextIdx = Math.min(
          historyIndexRef.current + 1,
          history.length - 1,
        );
        historyIndexRef.current = nextIdx;
        const entry = history[nextIdx] ?? '';
        setValue(entry);
        setCursorOffset(0);
        return;
      }

      if (key.downArrow && !key.meta && !key.shift) {
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

      // Tab: cycle role when empty, autocomplete when typing
      if (key.tab) {
        if (value.length === 0) {
          if (onCycleRole) onCycleRole();
          return;
        }
        if (!completions || completions.length === 0)
          return;

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
        setValue(
          (prev) => prev.slice(0, insertPos) + input + prev.slice(insertPos),
        );
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

  // Multi-line display
  const lines = value.split('\n');
  const lineCount = lines.length;
  const displayLine = lines[lines.length - 1] ?? '';
  const continuationHint = value.endsWith('\\');

  // Role display — truncate to prevent line wrap on narrow terminals
  const maxLabelLen = Math.max(10, (process.stdout.columns || 80) - 20);
  const rawLabel = roleIcon && roleName ? `${roleIcon} ${roleName}` : '\u2699 default';
  const modeLabel = rawLabel.length > maxLabelLen ? rawLabel.slice(0, maxLabelLen) + '...' : rawLabel;

  return (
    <Box
      borderStyle="round"
      borderColor={isDisabled ? colors.border : colors.borderFocus}
      paddingX={1}
      width="100%"
      flexDirection="column"
    >
      {/* Line 1: mode badge + Tab hint */}
      <Box justifyContent="space-between" width="100%">
        <Text color={colors.model} bold>{modeLabel}</Text>
        <Text color={colors.dimText}>Tab {'\u21C4'} mode</Text>
      </Box>

      {/* Lines 2-4: multi-line content or spacer */}
      {lineCount > 1 ? (
        <Box flexDirection="column">
          {lines.slice(Math.max(0, lineCount - 4), -1).map((l, i) => (
            <Box key={i}>
              <Text color={colors.dimText}>{`${i + 1}\u2502 `}</Text>
              <Text color={colors.userText}>{l}</Text>
            </Box>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box><Text> </Text></Box>
          <Box><Text> </Text></Box>
          <Box><Text> </Text></Box>
        </Box>
      )}

      {/* Line 3: input prompt */}
      <Box>
        <Text color={promptColor}>{prompt}</Text>
        <Text color={colors.userText}>{displayLine}</Text>
        {!isDisabled && <Text color={colors.dimText}>{'\u2588'}</Text>}
        {continuationHint && (
          <Text color={colors.dimText}> {'\u21B5'}</Text>
        )}
      </Box>
    </Box>
  );
});

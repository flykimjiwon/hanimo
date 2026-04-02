import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme.js';
import { COMMAND_LIST } from '../hooks/use-commands.js';

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

      // Shift+Enter: insert newline (multi-line input)
      // Fallback: trailing backslash + Enter also inserts newline
      if (key.return) {
        if (key.shift) {
          const insertPos = value.length - cursorOffset;
          setValue((prev) => prev.slice(0, insertPos) + '\n' + prev.slice(insertPos));
          setCursorOffset(0);
          return;
        }
        if (value.endsWith('\\')) {
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

  // Mode descriptions for placeholder hint
  const modeHints: Record<string, string> = {
    Hanimo: '\uC758\uB3C4 \uC790\uB3D9 \uAC10\uC9C0 \u2014 \uCF54\uB529, \uB300\uD654, \uBD84\uC11D, \uC2DC\uC2A4\uD15C \uAD00\uB9AC \uBAA8\uB450 \uAC00\uB2A5',    // 의도 자동 감지 — 코딩, 대화, 분석, 시스템 관리 모두 가능
    Dev: '\uCF54\uB529 \uC5D0\uC774\uC804\uD2B8 \u2014 \uD30C\uC77C \uC77D\uAE30/\uC4F0\uAE30, \uC170, git',                               // 코딩 에이전트 — 파일 읽기/쓰기, 셸, git
    Plan: '\uBD84\uC11D/\uACC4\uD68D \u2014 \uC77D\uAE30 \uC804\uC6A9, \uC218\uC815 \uBD88\uAC00',                                           // 분석/계획 — 읽기 전용, 수정 불가
  };
  const modeHint = roleName ? (modeHints[roleName] ?? '') : '';

  // Command dropdown: show when input starts with /
  const ko = true; // TODO: pass lang prop
  const commandMatches = useMemo(() => {
    if (!value.startsWith('/')) return [];
    const query = value.slice(1).toLowerCase();
    return COMMAND_LIST
      .filter(c => query.length === 0 || c.name.startsWith(query))
      .slice(0, 8); // max 8 suggestions
  }, [value]);

  return (
    <Box flexDirection="column" width="100%">
      {/* Command dropdown — appears above input when typing / */}
      {commandMatches.length > 0 && (
        <Box flexDirection="column" paddingX={2} marginBottom={0}>
          {commandMatches.map((cmd, i) => (
            <Box key={cmd.name}>
              <Text color={colors.hint}>  /</Text>
              <Text color={colors.model} bold>{cmd.name.padEnd(16)}</Text>
              <Text color={colors.dimText}>{ko ? cmd.descriptionKo : cmd.description}</Text>
            </Box>
          ))}
        </Box>
      )}
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
        <Text color={colors.dimText}>Shift+Enter {'\u21B5'}  Tab {'\u21C4'} mode</Text>
      </Box>

      {/* Multi-line content or mode hint */}
      {lineCount > 1 ? (
        <Box flexDirection="column">
          {lines.slice(Math.max(0, lineCount - 4), -1).map((l, i) => (
            <Box key={i}>
              <Text color={colors.dimText}>{`${i + 1}\u2502 `}</Text>
              <Text color={colors.userText}>{l}</Text>
            </Box>
          ))}
        </Box>
      ) : modeHint && value.length === 0 ? (
        <Box><Text color={colors.dimText} dimColor>{modeHint}</Text></Box>
      ) : (
        <Box><Text> </Text></Box>
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
    </Box>
  );
});

# TUI Redesign Plan

## Overview

The current TUI has several polish issues rooted in how Ink/React manages layout. This document describes the known bugs, their root causes, and a phased redesign plan that brings hanimo's TUI to the quality level of lazygit, btop, opencode, and Claude Code.

---

## Known Bugs

### 1. Status bar sometimes renders as 2 lines

**Symptom:** The status bar occasionally wraps to a second line when terminal width is near the content length, or when ANSI sequences inflate the visual length calculation.

**Partial fix applied:** `height={1} overflow="hidden"` on the inner Box. Still reported intermittently.

**Root cause:** The padding calculation in `status-bar.tsx` uses raw string `.length` on the `left` variable, but `left` contains no ANSI codes while the rendered `<Text>` components do add Ink-internal escape sequences. The padding formula can undercount available space, pushing the right section past the terminal edge and triggering Ink's word-wrap.

### 2. Blank lines / scroll artifacts after sending a message

**Symptom:** After a message is sent and streaming completes, extra blank lines appear below the last message.

**Root cause:** The streaming `<Box>` at line 244 uses an explicit `height` computed as:
```tsx
height={Math.min(height - visibleMessages.length * 2, Math.max(3, height / 2))}
```
This formula assumes 2 lines per message, which is rarely correct. When `visibleMessages.length` is small, the formula allocates far too much height to the streaming box, and that reserved space becomes empty blank lines after streaming ends and the box unmounts.

### 3. Scroll indicators appear but scrolling feels awkward

**Symptom:** The `↑ N more` / `↓ N below` indicators render, but jumping by 3 messages feels coarse and the viewport doesn't reflow cleanly.

**Root cause:** `estimateLines` uses raw `line.length / usableWidth` which does not account for:
- ANSI escape sequences (inflate byte length without adding visible characters)
- Emoji / CJK wide characters (each counts as 2 columns)
- Ink's own padding/margin bytes

This causes the viewport to either cut off messages early or show too few messages.

### 4. Overall "not polished" feeling

Multiple small issues compound: no separator between the chat area and input bar, slight jitter on every keypress because Ink re-renders the full tree, and the header being part of the flow rather than pinned.

---

## Root Causes Summary

| Area | Root Cause |
|------|-----------|
| StatusBar | Ink `<Text>` wraps when content nears terminal width; padding formula uses raw lengths |
| ChatView streaming box | Explicit `height` based on wrong formula leaves ghost space |
| Line estimation | Raw `string.length` ignores ANSI escape bytes and wide characters |
| Layout | Header/footer are flex children, not fixed-position overlays |
| Scroll | Message-count-based offset rather than line-count-based viewport |

---

## Design Reference — Best Practices from Production TUIs

**lazygit / btop / opencode / Claude Code patterns:**

- Header and footer are **fixed 1-line regions** at top and bottom — never flex children
- Content area fills the remaining height using `height = terminalHeight - headerLines - footerLines`
- Scroll is **viewport-based**: a slice of a message buffer, not DOM overflow
- No blank lines between sections
- Terminal resize recalculates viewport height and re-renders once
- Wide character widths are computed with `wcwidth` or equivalent (each CJK/emoji = 2 columns)
- ANSI escape sequences are stripped before measuring visible length

---

## Redesign Plan

### Phase 1 — Fix Critical Bugs (immediate)

#### 1A. Fix ChatView streaming box height

**File:** `src/tui/components/chat-view.tsx`

Remove the explicit `height` prop from the streaming `<Box>`. Let it flow naturally inside the parent's `overflowY="hidden"` container.

**Before:**
```tsx
<Box paddingX={1} flexDirection="column"
  height={Math.min(height - visibleMessages.length * 2, Math.max(3, height / 2))}
  overflowY="hidden">
```

**After:**
```tsx
<Box paddingX={1} flexDirection="column" overflowY="hidden">
```

The parent `<Box flexDirection="column" height={height} overflowY="hidden">` already clips content to the available height. Nesting an explicit height inside it creates conflicting constraints that leave blank space.

#### 1B. Verify status bar single-line rendering

**File:** `src/tui/components/status-bar.tsx`

Ensure:
1. The inner Box has `height={1}` and `overflow="hidden"` (already present, keep it)
2. No nested `<Box>` elements inside the single-line area — all content in one `<Text>` chain
3. The `padding` calculation strips ANSI before measuring, or uses a conservative buffer

#### 1C. Remove ghost blank lines

Audit all `<MessageBubble>` variants for `marginBottom` or `paddingBottom`. Confirm the outer `flexDirection="column"` container has no gap between children.

---

### Phase 2 — Layout Regions (next sprint)

Establish three fixed layout regions:

```
┌─────────────────────────────────┐  ← line 0
│ StatusBar (1 line)              │
│ Separator (1 line, ─────────── )│
├─────────────────────────────────┤  ← line 2
│                                 │
│ ChatView (fills remaining)      │
│                                 │
├─────────────────────────────────┤  ← line H-6
│ InputBar (3-5 lines)            │
│ KeyHints (1 line)               │
└─────────────────────────────────┘  ← line H
```

**Implementation approach:**

```tsx
const chatHeight = terminalHeight - 2 - inputBarHeight - 1; // header + separator + input + keyhints
```

Pass `chatHeight` explicitly to `<ChatView>`. Pass `inputBarHeight` explicitly to `<InputBar>`. Never use `flexGrow` for these regions — use explicit pixel heights.

---

### Phase 3 — Viewport-Based Scroll (next sprint)

Replace line-estimation-based scroll with a pure buffer+slice approach:

```
messages: DisplayMessage[]       // full history
buffer: RenderedLine[]           // pre-rendered lines (string[])
viewportStart: number            // index into buffer
viewportHeight: number           // = chatHeight
```

**Scroll logic:**
```
scrollUp(n)   → viewportStart = max(0, viewportStart - n)
scrollDown(n) → viewportStart = min(buffer.length - viewportHeight, viewportStart + n)
autoScroll    → viewportStart = buffer.length - viewportHeight
```

Each message is pre-rendered into lines by wrapping at `terminalWidth - 2` columns (with proper wide-char support). Streaming appends to the last entry in `buffer` and re-renders only the viewport slice.

---

### Phase 4 — Wide Character and ANSI Support

Replace `line.length` with a `visibleWidth(str)` function:

```ts
// Strip ANSI escape sequences, then sum codepoint widths
function visibleWidth(str: string): number {
  const stripped = str.replace(/\x1B\[[0-9;]*m/g, '');
  let w = 0;
  for (const ch of stripped) {
    const cp = ch.codePointAt(0) ?? 0;
    w += isWide(cp) ? 2 : 1;
  }
  return w;
}
```

Use this in `estimateLines` and in the status-bar padding calculation.

---

### Phase 5 — Terminal Resize Handling

Subscribe to `process.stdout` `'resize'` events:

```ts
useEffect(() => {
  const handleResize = () => {
    setTerminalSize({
      cols: process.stdout.columns,
      rows: process.stdout.rows,
    });
  };
  process.stdout.on('resize', handleResize);
  return () => process.stdout.off('resize', handleResize);
}, []);
```

On resize: recalculate `chatHeight`, `viewportHeight`, re-wrap the buffer. The re-wrap is O(buffer lines) but is only triggered on resize, not on every keystroke.

---

## Streaming Architecture

When the model streams tokens:

1. Append chunk to `currentStreamText` (string)
2. Re-wrap `currentStreamText` into lines using `visibleWidth`
3. Replace the last N lines of the viewport buffer with the new wrapped lines
4. Re-render only the chat area (viewport slice) — not the status bar or input

This avoids the current problem where every streaming chunk triggers a full Ink tree re-render including the status bar and input box, which causes jitter.

---

## Files Affected

| File | Change |
|------|--------|
| `src/tui/components/chat-view.tsx` | Phase 1: remove streaming box height; Phase 3: viewport model |
| `src/tui/components/status-bar.tsx` | Phase 1: verify single-line; Phase 4: visibleWidth in padding |
| `src/tui/components/input-bar.tsx` | Phase 2: explicit height prop |
| `src/tui/app.tsx` | Phase 2: explicit layout heights; Phase 5: resize handler |
| `src/tui/utils/text-width.ts` | Phase 4: new utility (visibleWidth, isWide) |

---

## Success Criteria

- [ ] Status bar never wraps to 2 lines at any terminal width >= 60 cols
- [ ] No blank lines after streaming completes
- [ ] Scroll moves by lines (not messages) and feels fluid
- [ ] Terminal resize reflows without artifacts
- [ ] All existing tests pass
- [ ] `npx tsc --noEmit` reports zero errors

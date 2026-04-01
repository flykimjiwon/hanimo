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

## Framework 대안 평가: OpenTUI

현재 hanimo TUI는 Ink(React for terminal)을 사용하지만, TUI 폴리시 문제의 근본 원인 중 상당수가 Ink의 한계에서 비롯됩니다. OpenTUI는 유력한 대안입니다.

### OpenTUI란?

- **3가지 프레임워크**: Core (imperative), React reconciler, Solid reconciler
- **Bun 기반**, Zig 네이티브 빌드
- **내장 컴포넌트**: Markdown 스트리밍, Code viewer, Diff viewer, TextTable, ScrollBox 등 20+
- **레이아웃**: Yoga/Flexbox 엔진 + Absolute positioning
- **키보드**: Focus management, 단축키, 클립보드
- **테스트**: 스냅샷 + 인터랙션 테스트 내장
- **주요 사용처**: opencode, codex, github-copilot, gemini-cli, amp, kimi-cli (주간 2K 설치)

### Ink vs OpenTUI 비교

| 항목 | Ink 5 | OpenTUI (React) |
|------|-------|-----------------|
| 런타임 | Node.js | Bun |
| 레이아웃 | 자체 (불안정) | Yoga (검증됨) |
| 스크롤 | 없음 (수동 구현) | ScrollBox 내장 |
| Markdown 렌더링 | 없음 (수동 구현) | 내장 (스트리밍 지원) |
| Diff viewer | 없음 | 내장 |
| 줄바꿈 제어 | 약함 (overflow 이슈) | 강함 (Yoga 기반) |
| 와이드 문자 | 미지원 | 지원 |
| 커뮤니티 | 성숙하지만 활발하지 않음 | 신생이지만 빠르게 성장 |

### 마이그레이션 전략

**단기 (현재)**: Phase 1-2에서 Ink 내에서 최대한 수정
**중기**: OpenTUI React reconciler로 마이그레이션 검토
- hanimo가 이미 React 기반이므로 컴포넌트 구조 재사용 가능
- Core 엔진 (agent-loop, tools, providers)은 무관
- TUI 컴포넌트만 교체 (chat-view, status-bar, input-bar, select-menu)

**마이그레이션 시 고려사항**:
- Bun 의존성 추가 (현재는 Node.js만)
- OpenTUI가 아직 알파/베타 단계
- create-tui CLI로 프로젝트 구조 생성 필요
- `process.exit()` 대신 `renderer.destroy()` 사용 필수

### 결론

Phase 1-2를 Ink에서 진행하고, Phase 3(뷰포트 스크롤) 시점에서 OpenTUI 마이그레이션 여부를 결정합니다. OpenTUI의 ScrollBox + Markdown 스트리밍이 내장되어 있으므로 Phase 3-5를 통째로 대체할 수 있습니다.

---

## TUI Studio 참고

[TUI Studio](https://tui.studio)는 터미널 UI를 시각적으로 설계할 수 있는 Figma 유사 도구입니다:
- Ink, BubbleTea, OpenTUI 등 6개 프레임워크 코드 내보내기 예정 (현재 알파)
- hanimo TUI 레이아웃 설계에 활용 가능
- `.tui` JSON 파일로 팀 간 디자인 공유

---

## Success Criteria

- [ ] Status bar never wraps to 2 lines at any terminal width >= 60 cols
- [ ] No blank lines after streaming completes
- [ ] Scroll moves by lines (not messages) and feels fluid
- [ ] Terminal resize reflows without artifacts
- [ ] All existing tests pass
- [ ] `npx tsc --noEmit` reports zero errors

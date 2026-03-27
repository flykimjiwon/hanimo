# Ink 5.x/6.x Best Practices for Fullscreen Terminal Applications

> **Research Date**: 2026-03-27
> **Latest Ink Version**: 6.8.0 (as of February 2026)
> **Based on**: vadimdemedes/ink - React for interactive command-line apps

---

## Table of Contents

1. [Version Status & React Compatibility](#version-status--react-compatibility)
2. [Fullscreen Mode & Options](#fullscreen-mode--options)
3. [Static Component](#static-component)
4. [useInput Hook](#useinput-hook)
5. [useStdout Hook](#usestdout-hook)
6. [Spinner Rendering Issues](#spinner-rendering-issues)
7. [Streaming Text & Performance](#streaming-text--performance)
8. [Memory Leaks](#memory-leaks)
9. [Error Boundaries](#error-boundaries)
10. [Known Bugs & Limitations](#known-bugs--limitations)
11. [Experimental Mode](#experimental-mode)

---

## Version Status & React Compatibility

### Current Version
- **Latest**: Ink 6.8.0 (published ~1 month ago as of March 2026)
- **Notable Ink 5.0.0 Feature**: No breaking changes despite major version bump (required Node.js 18)
- **Ink 6.8.0 Features**:
  - Added `renderToString()` for synchronous string output
  - Added support for react-devtools v7
  - Allows `exit()` to pass a result value to `waitUntilExit()`
  - Performance improvements via caching expensive calls

### React Compatibility Matrix

| Ink Version | React Version | Status |
|-------------|---------------|--------|
| Ink 4.x | React 18 | ✅ Supported |
| Ink 5.x | React 18 | ✅ Supported |
| Ink 6.x | React 18 | ✅ Supported |
| Ink 5.x/6.x | React 19 | ❌ **NOT SUPPORTED** |

**Critical Issue**: Ink does NOT work with React 19 as of March 2026.

- **Error**: `TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')`
- **Issue**: [GitHub #688](https://github.com/vadimdemedes/ink/issues/688) (opened December 2024)
- **Impact**: Affects Shopify CLI and other major projects
- **Workaround**: Stick to React 18.x for production apps

---

## Fullscreen Mode & Options

### Using Fullscreen Mode

Ink itself doesn't have built-in fullscreen support, but you can use the `fullscreen-ink` package:

```bash
npm install fullscreen-ink
```

**Key Features**:
- Uses Ink's alternate screen buffer
- Renders on a separate screen; original terminal content restored on exit
- Accepts all standard Ink render options

### Render Options

```typescript
import { render } from 'ink';

render(<App />, {
  exitOnCtrlC: false,      // Disable default Ctrl+C behavior
  patchConsole: true,      // Intercept console.log/error
  experimental: true,      // Enable new reconciler (60fps limit)
});
```

**exitOnCtrlC Option**:
- **Default**: `true` (app exits on Ctrl+C)
- **Set to `false`**: Allows custom handling of Ctrl+C via `useInput`
- **Use Case**: When you need custom cleanup or confirmation prompts

**fullscreen-ink Integration**:
```typescript
import { withFullScreen } from 'fullscreen-ink';

const FullScreenApp = withFullScreen(App, {
  exitOnCtrlC: false,
  experimental: true,
});
```

### Alternate Screen Buffer

When enabled, Ink renders on a separate screen buffer:
- Original terminal content is preserved
- Clean exit restores previous terminal state
- Ideal for immersive fullscreen UIs

---

## useStdout Hook

### Getting Terminal Dimensions

```typescript
import { useStdout } from 'ink';

function MyComponent() {
  const { stdout } = useStdout();

  // WARNING: stdout.rows/columns can be undefined in non-TTY environments
  const width = stdout.columns || 80;   // Fallback to 80
  const height = stdout.rows || 24;     // Fallback to 24

  return <Box width={width} height={height}>...</Box>;
}
```

**Alternative**: Use `useScreenSize()` hook (internal to fullscreen-ink):
```typescript
const { width, height } = useScreenSize();
```

### Handling Terminal Resize

```typescript
import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

function ResponsiveComponent() {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState({
    width: stdout.columns || 80,
    height: stdout.rows || 24,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: stdout.columns || 80,
        height: stdout.rows || 24,
      });
    };

    stdout.on('resize', handleResize);
    return () => stdout.off('resize', handleResize);
  }, [stdout]);

  return <Box width={dimensions.width} height={dimensions.height}>...</Box>;
}
```

**Best Practice**: Always provide fallback dimensions for non-TTY environments.

---

## Static Component

### Purpose
The `<Static>` component is a terminal-specific implementation of virtual lists for rendering **large, unpredictable numbers of items**.

### How It Works
- Renders new items **permanently above** the rest of your UI
- Items are **immutable** once rendered (cannot update after display)
- Think of it as append-only terminal output

### When to Use
✅ **Good Use Cases**:
- Log streams
- Build output
- Chat history
- Long lists of completed tasks

❌ **Avoid For**:
- Frequently updating status indicators
- Spinners or progress bars
- Interactive lists (use regular components)

### Example

```typescript
import { Static, Text } from 'ink';

function LogViewer({ logs }) {
  return (
    <>
      <Static items={logs}>
        {(log, index) => (
          <Text key={index}>{log}</Text>
        )}
      </Static>
      <Text>Current status: Processing...</Text>
    </>
  );
}
```

### Known Issues
- **Cannot update** rendered items (by design)
- **Console interference**: When React error boundaries trigger, `console.log` warnings can interfere with Static component rendering, causing new items to append instead of replacing

**Workaround**: Use Ink 3+'s built-in console interception (`patchConsole: true`).

---

## useInput Hook

### Basic Usage

```typescript
import { useInput } from 'ink';

function InputHandler() {
  useInput((input, key) => {
    if (input === 'q') {
      process.exit();
    }

    if (key.leftArrow) {
      // Handle left arrow
    }

    if (key.upArrow) {
      // Handle up arrow
    }

    // Shift+Tab detection (Ink 3+ improvement)
    if (key.shift && key.tab) {
      // Handle Shift+Tab
    }
  });

  return <Text>Press 'q' to quit</Text>;
}
```

### Input Characteristics

1. **Character-by-character**: Callback is invoked for each character typed
2. **Paste optimization**: If user pastes multi-character text, callback is invoked **once** with the entire string
3. **Arrow keys**: Corresponding properties (`key.leftArrow`, `key.rightArrow`, etc.) are `true` when pressed
4. **Improved in Ink 3**: More reliable parsing, better key combination support (e.g., Shift+Tab)

### Multiple useInput Hooks

When multiple components use `useInput`, **all hooks receive the same input**. To prevent conflicts:

```typescript
import { useInput } from 'ink';
import { useState } from 'react';

function MultiInputApp() {
  const [activePane, setActivePane] = useState('left');

  useInput((input, key) => {
    // Global shortcuts
    if (key.tab) {
      setActivePane(activePane === 'left' ? 'right' : 'left');
    }
  });

  return (
    <>
      <LeftPane isActive={activePane === 'left'} />
      <RightPane isActive={activePane === 'right'} />
    </>
  );
}

function LeftPane({ isActive }) {
  useInput((input, key) => {
    if (!isActive) return; // Ignore input when not active

    // Handle left pane input
  }, { isActive }); // Enable/disable based on state

  return <Text>Left Pane</Text>;
}
```

### Enable/Disable Input Capture

```typescript
useInput((input, key) => {
  // Handle input
}, { isActive: shouldCapture });
```

**Use Case**: When you have multiple input handlers and need to control which one is active.

---

## Spinner Rendering Issues

### The Problem
**Spinners repeat on new lines instead of updating in place**, especially in long-running applications.

#### Root Cause
Ink's architecture performs **full-tree traversal and complete screen redraws** on every React state change. The rendering cycle:
1. Erase ALL previous lines (cursor moves up, clears each line)
2. Write complete new output
3. This erase-and-redraw is **visible** to users, especially in terminals like tmux without double-buffering

#### When It Happens
- Long conversations or logs
- Fast-updating spinners (high frequency state changes)
- Terminals without sophisticated double-buffering (tmux, some SSH clients)

### Solutions

#### 1. Use Static Component for Logs
```typescript
import { Static, Box, Text } from 'ink';
import Spinner from 'ink-spinner';

function App({ logs }) {
  return (
    <>
      <Static items={logs}>
        {(log, index) => <Text key={index}>{log}</Text>}
      </Static>

      <Box>
        <Spinner type="dots" />
        <Text> Processing...</Text>
      </Box>
    </>
  );
}
```

**Why It Works**: Static component renders logs permanently above, so spinner only updates its own section.

#### 2. Enable Experimental Mode
```typescript
render(<App />, { experimental: true });
```

**Benefits**:
- New reconciler limits renders to **60 FPS**
- Only updates **necessary parts** of the layout
- Significantly reduces unnecessary redraws

#### 3. Reduce Spinner Update Frequency
```typescript
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function SlowSpinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 200); // Slower: 200ms instead of default 80ms

    return () => clearInterval(timer);
  }, []);

  return <Text>{frames[frame]}</Text>;
}
```

#### 4. Prototype Special Rendering Mode
For advanced users: Implement a special rendering mode for status lines that doesn't require full redraws. This is a deep architectural change but can eliminate flickering entirely.

---

## Streaming Text & Performance

### The Flickering Problem
Fast-updating text causes visible flicker because Ink erases and rewrites the entire output on every state change.

### Solutions

#### 1. Incremental Rendering Mode
Ink provides an **incremental rendering mode** that only updates changed lines:

```typescript
render(<App />, {
  experimental: true,  // Enables incremental rendering
});
```

**How It Works**:
- Only redraws lines that actually changed
- Reduces CPU usage
- Minimizes visual flicker

#### 2. Control FPS (Frames Per Second)
Ink's default is **30 FPS**, but experimental mode caps at **60 FPS**:

```typescript
// Experimental mode automatically limits to 60 FPS
render(<App />, { experimental: true });
```

**Trade-offs**:
- Higher FPS = more responsive, but higher CPU usage
- Lower FPS = less CPU, but may feel sluggish for fast updates

#### 3. Debounce Rapid Updates

```typescript
import { useState, useEffect } from 'react';
import { Text } from 'ink';

function StreamingText({ stream }) {
  const [bufferedText, setBufferedText] = useState('');

  useEffect(() => {
    let buffer = '';
    let timeoutId;

    const handleData = (chunk) => {
      buffer += chunk;

      // Debounce: only update every 100ms
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setBufferedText(buffer);
      }, 100);
    };

    stream.on('data', handleData);

    return () => {
      stream.off('data', handleData);
      clearTimeout(timeoutId);
    };
  }, [stream]);

  return <Text>{bufferedText}</Text>;
}
```

**Benefit**: Reduces re-render frequency while maintaining smooth appearance.

#### 4. Viewport Constraints
**Critical Limitation**: Terminals can't rerender output taller than the terminal window.

```typescript
import { useStdout } from 'ink';

function ViewportAwareComponent({ content }) {
  const { stdout } = useStdout();
  const maxHeight = (stdout.rows || 24) - 2; // Reserve space for UI

  const visibleContent = content.slice(-maxHeight);

  return (
    <>
      {visibleContent.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </>
  );
}
```

**Why**: If output is 60 rows but terminal is 50 rows, first 10 rows won't be rerendered (out of viewport).

---

## Memory Leaks

### Common Causes in React (applies to Ink)

#### 1. Timers Not Cleared
```typescript
// ❌ BAD: Memory leak
function BadComponent() {
  useEffect(() => {
    setInterval(() => {
      console.log('Leaked!');
    }, 1000);
  }, []);

  return <Text>Component</Text>;
}

// ✅ GOOD: Proper cleanup
function GoodComponent() {
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Safe');
    }, 1000);

    return () => clearInterval(timer); // Cleanup
  }, []);

  return <Text>Component</Text>;
}
```

#### 2. Event Listeners Not Removed
```typescript
// ❌ BAD: Memory leak
function BadListener() {
  useEffect(() => {
    const handleData = (data) => console.log(data);
    process.stdin.on('data', handleData);
  }, []);

  return <Text>Listening...</Text>;
}

// ✅ GOOD: Proper cleanup
function GoodListener() {
  useEffect(() => {
    const handleData = (data) => console.log(data);
    process.stdin.on('data', handleData);

    return () => process.stdin.off('data', handleData);
  }, []);

  return <Text>Listening...</Text>;
}
```

#### 3. Subscriptions Not Cancelled
```typescript
import { useEffect } from 'react';

function Subscriber({ observable }) {
  useEffect(() => {
    const subscription = observable.subscribe((data) => {
      // Handle data
    });

    return () => subscription.unsubscribe();
  }, [observable]);

  return <Text>Subscribed</Text>;
}
```

### Why Memory Leaks Matter in Terminal Apps
- **Single Page App (SPA) behavior**: Terminal apps don't fully refresh, just update the DOM-like tree via React's reconciliation
- **Long-running processes**: CLI apps often run for extended periods (servers, watchers, etc.)
- **Accumulation**: Unreleased resources pile up, consuming more RAM over time

### Prevention Checklist
✅ Always return cleanup functions from `useEffect`
✅ Clear timers with `clearInterval`/`clearTimeout`
✅ Remove event listeners in cleanup
✅ Cancel subscriptions and abort fetch requests
✅ Test components by mounting/unmounting repeatedly

---

## Error Boundaries

### Ink 3+ Built-in Error Handling

Ink 3 introduced a **global React error boundary** that pretty-prints errors:

```typescript
render(<App />, {
  patchConsole: true, // Enables console interception + error boundary
});
```

**Features**:
- Beautiful error overview with stack trace
- Filters out irrelevant information
- Intercepts `console.log`, `console.error`, etc.
- Ensures logs display correctly **above** your app's UI

### Custom Error Boundaries

```typescript
import React from 'react';
import { Text, Box } from 'ink';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to external service
    console.error('Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" borderStyle="round" borderColor="red">
          <Text color="red">Error: {this.state.error.message}</Text>
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary>
      <YourComponent />
    </ErrorBoundary>
  );
}
```

### Known Issue: Error Boundary Console Warnings

**Problem**: When `getDerivedStateFromError` is called, React prints a warning to console. This log output can cause the error boundary UI to append below previous component instead of replacing it.

**Solution**: Use Ink's built-in `patchConsole: true` option, which intercepts console output to prevent interference.

---

## Known Bugs & Limitations

### 1. **React 19 Incompatibility** ⚠️ CRITICAL
- **Status**: Not supported as of March 2026
- **Error**: `TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')`
- **Issue**: [GitHub #688](https://github.com/vadimdemedes/ink/issues/688)
- **Workaround**: Use React 18.x

### 2. **Full-Tree Redraws on Every State Change**
- **Issue**: Ink performs complete screen redraws for any state change, even if only one component updated
- **Impact**: Flickering, high CPU usage, poor performance for fast updates
- **Workaround**: Enable experimental mode for incremental rendering

### 3. **Viewport Limitation**
- **Issue**: Cannot rerender output taller than terminal window
- **Example**: 60-row output in 50-row terminal = first 10 rows won't rerender
- **Workaround**: Implement scrolling or limit visible content to terminal height

### 4. **Static Component Immutability**
- **Issue**: Once rendered, Static component items cannot be updated
- **Impact**: Not suitable for frequently changing data
- **Workaround**: Use regular components for dynamic content

### 5. **Console Interference with Static**
- **Issue**: React's error boundary warnings interfere with Static component rendering
- **Workaround**: Use `patchConsole: true` option

### 6. **Spinner Line Repetition**
- **Issue**: Spinners print on new lines in long-running apps
- **Root Cause**: Erase-and-redraw rendering cycle
- **Workarounds**: Use Static for logs, enable experimental mode, reduce update frequency

### 7. **Flickering in Terminals Without Double-Buffering**
- **Issue**: Visible flicker in tmux, some SSH clients
- **Cause**: Terminal doesn't buffer screen updates
- **Workaround**: Use incremental rendering (experimental mode)

### 8. **30 FPS Rendering Limit (Non-Experimental)**
- **Issue**: Default rendering capped at 30 FPS
- **Impact**: May feel sluggish for fast-updating UIs
- **Workaround**: Enable experimental mode (60 FPS limit)

### 9. **Performance Degradation with High-Frequency Updates**
- **Issue**: Rebuilding entire layout on every update is taxing
- **Workaround**: Debounce updates, use experimental mode

### 10. **IDE Support Issues**
- **Note**: (Related to Polkadot's ink! smart contract language, not vadimdemedes/ink)
- RLS and rust-analyzer struggle with macro instantiations
- Not relevant to React Ink CLI apps

---

## Experimental Mode

### What Is It?
Experimental mode enables a **new reconciler and renderer** with significant performance improvements.

### How to Enable
```typescript
import { render } from 'ink';

render(<App />, { experimental: true });
```

### Benefits
✅ **Incremental rendering**: Only updates changed parts of the layout
✅ **60 FPS limit**: Prevents excessive re-rendering
✅ **Better performance**: ~2x faster in high-frequency re-render scenarios
✅ **Reduced CPU usage**: Less work per render cycle
✅ **Reduced flickering**: Fewer unnecessary redraws

### Trade-offs
⚠️ **Experimental**: May have undiscovered bugs
⚠️ **Not default**: Requires explicit opt-in
⚠️ **Still 60 FPS cap**: May not be enough for ultra-fast updates (e.g., 120 FPS displays)

### When to Use
- ✅ High-frequency updates (spinners, progress bars, streaming logs)
- ✅ Large UIs with many components
- ✅ Long-running apps where performance matters
- ✅ Production apps where stability is acceptable risk

### When to Avoid
- ❌ Maximum stability required (stick to stable mode)
- ❌ Edge-case terminal emulators (test thoroughly)

---

## Best Practices Summary

### Do's ✅
1. **Always use experimental mode** for production apps (better performance, minimal risk)
2. **Use Static component** for append-only content (logs, history)
3. **Clean up timers and event listeners** in `useEffect` return functions
4. **Provide fallback dimensions** when using `useStdout` (handle non-TTY)
5. **Enable `patchConsole: true`** for better error handling
6. **Debounce rapid updates** to reduce re-render frequency
7. **Limit visible content** to terminal height to avoid viewport issues
8. **Test in different terminals** (tmux, iTerm, Windows Terminal, SSH clients)
9. **Use fullscreen-ink** for immersive fullscreen UIs
10. **Stick to React 18.x** until React 19 support is added

### Don'ts ❌
1. **Don't use React 19** (not supported as of March 2026)
2. **Don't update Static component items** after rendering (immutable by design)
3. **Don't ignore cleanup** in `useEffect` (causes memory leaks)
4. **Don't render more than terminal height** (causes viewport issues)
5. **Don't use multiple active `useInput` hooks** without disabling inactive ones
6. **Don't update too frequently** without debouncing (causes flickering)
7. **Don't assume stdout.rows/columns exist** (can be undefined in non-TTY)
8. **Don't mix Static and dynamic content** in the same section (causes rendering conflicts)

---

## Performance Optimization Checklist

- [ ] Enable experimental mode (`experimental: true`)
- [ ] Use Static component for logs/history
- [ ] Debounce fast-updating text/spinners
- [ ] Clean up timers/listeners in useEffect
- [ ] Limit visible content to terminal height
- [ ] Test in multiple terminal emulators
- [ ] Profile with React DevTools (v7 supported in Ink 6.8.0)
- [ ] Monitor CPU usage during long runs
- [ ] Use `patchConsole: true` for cleaner errors

---

## References & Sources

### Official Documentation
- [Ink GitHub Repository](https://github.com/vadimdemedes/ink)
- [Ink npm Package](https://www.npmjs.com/package/ink)
- [Ink 6.5.0 Release Notes](https://github.com/vadimdemedes/ink/releases/tag/v6.5.0)
- [Ink 5.0.0 Release Notes](https://github.com/vadimdemedes/ink/releases/tag/v5.0.0)
- [Ink 3 Announcement](https://vadimdemedes.com/posts/ink-3)

### Key GitHub Issues
- [React 19 Support Issue #688](https://github.com/vadimdemedes/ink/issues/688)
- [Spinner/Flickering Issue #359](https://github.com/vadimdemedes/ink/issues/359)
- [Fullscreen Support Discussion #263](https://github.com/vadimdemedes/ink/issues/263)
- [Error Boundary Issue #234](https://github.com/vadimdemedes/ink/issues/234)

### Community Resources
- [Building Beautiful CLIs with Ink (Medium, Jan 2026)](https://medium.com/@sohail_saifi/building-beautiful-clis-with-ink-yes-thats-react-running-in-your-terminal-683e25582d36)
- [Creating Terminal Apps with Ink + TypeScript (Medium)](https://medium.com/@pixelreverb/creating-a-terminal-application-with-ink-react-typescript-an-introduction-da49f3c012a8)
- [TUI Development: Ink + React (Combray)](https://combray.prose.sh/2025-12-01-tui-development)
- [Ink Flickering Analysis (GitHub)](https://github.com/atxtechbro/test-ink-flickering/blob/main/INK-ANALYSIS.md)
- [Add Interactivity to CLIs with React (LogRocket)](https://blog.logrocket.com/add-interactivity-to-your-clis-with-react/)

### Related Tools
- [fullscreen-ink Package](https://www.npmjs.com/package/fullscreen-ink)
- [ink-use-stdout-dimensions](https://www.npmjs.com/package/ink-use-stdout-dimensions)

### React Resources
- [How to Fix Memory Leaks in React (FreeCodeCamp)](https://www.freecodecamp.org/news/fix-memory-leaks-in-react-apps/)
- [Understanding Memory Leaks in React (Medium)](https://medium.com/@ignatovich.dm/understanding-memory-leaks-in-react-how-to-find-and-fix-them-fc782cf182be)

---

## Changelog

- **2026-03-27**: Initial research compilation (Ink 6.8.0, React 18/19 status, experimental mode, performance optimization)


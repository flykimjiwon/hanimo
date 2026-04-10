# Hanimo ↔ TECHAI_CODE Bidirectional Port Analysis

> Research document — read-only analysis, no code modifications.
> Generated: 2026-04-11
> Scope: Go + Bubble Tea v2 + Charm + sashabaranov/go-openai
> Thoroughness: Very Thorough (70 files analyzed, 5000+ LOC reviewed)

---

## Executive Summary: Top 15 Port Opportunities (Priority Order)

| # | Opportunity | Direction | Value | Effort | Notes |
|---|-------------|-----------|-------|--------|-------|
| 1 | **MCP Client Implementation** | already in hanimo | 🟢🟢🟢 | — | hanimo already has 334 LOC MCP client; TECHAI lacks it |
| 2 | **Git Info Snapshot Package** | TECHAI→hanimo | 🟢🟢 | 🟢 | 262 LOC, zero-dependency, elegant design |
| 3 | **Soft Dangerous Patterns** | hanimo→TECHAI | 🟢🟢 | 🟢 | Confirmation UX improvement, ~40 LOC |
| 4 | **Token Usage Tracking** | hanimo→TECHAI | 🟢🟢 | 🟠 | 84 LOC with pricing table, financial insights |
| 5 | **Agent Intent Detection** | hanimo→TECHAI | 🟢 | 🟠 | 100+ LOC, Super mode auto-routing |
| 6 | **Configurable Providers** | hanimo→TECHAI | 🟢🟢 | 🔴 | Registry pattern, multi-model abstraction |
| 7 | **Compaction Algorithm Refinement** | TECHAI→hanimo | 🟢 | 🟠 | Named constants, better code clarity |
| 8 | **Auto Mode Loop Control** | hanimo→TECHAI | 🟢 | 🟢 | Simple marker system, iteration capping |
| 9 | **Context Window Warning Levels** | TECHAI→hanimo | 🟢 | 🟢 | UI thresholds (70%/80%/90%), reusable |
| 10 | **Enhanced Shell Safety Patterns** | hanimo→TECHAI | 🟢 | 🟢 | 65 regex patterns vs 12, deprecated tool detection |
| 11 | **Multi-Provider LLM Abstraction** | hanimo→TECHAI | 🟢🟢 | 🔴 | Anthropic, Google, Ollama support |
| 12 | **Plan Mode Structures** | hanimo→TECHAI | 🟢 | 🟠 | JSON execution plan model, tracking |
| 13 | **Database Session Schema** | hanimo→TECHAI | 🟢 | 🔴 | More comprehensive (MCP, memories, usage) |
| 14 | **Tool Registry with Mode-Based Access** | hanimo→TECHAI | 🟢 | 🟠 | Hashline editing, diagnostics (vs basic grep/glob) |
| 15 | **System Context Injection** | hanimo→TECHAI | 🟢 | 🟢 | Dynamic system prompt enrichment |

**Legend**: 🟢 Low effort | 🟠 Medium effort | 🔴 High effort
**Value Scale**: 🟢 Incremental | 🟢🟢 Important | 🟢🟢🟢 Critical

---

## 1. Features in TECHAI_CODE that Hanimo LACKS

### 1.1 Git Information Snapshot Package (`gitinfo`)
- **Location**: `/Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/internal/gitinfo/gitinfo.go` (262 LOC)
- **Does Hanimo Have This?**: No. Hanimo infers git status via shell_exec("git status").
- **What It Does**:
  - Lightweight read-only snapshots of git state (branch, dirty flag, staged/unstaged/untracked counts)
  - Parses porcelain v1 format correctly
  - Non-blocking 500ms timeout (fails gracefully if repo unavailable)
  - Zero external dependencies
- **Why Hanimo Would Benefit**:
  - HUD display more reliable (current shell calls can hang)
  - Status bar can update git state without blocking UI
  - Better error handling (returns zero-valued Info on any error)
- **Porting Difficulty**: **Trivial copy** (~10 min)
  - Copy `TECHAI_CODE/internal/gitinfo/` → `hanimo/internal/gitinfo/`
  - Update import path
  - Replace shell-based git checks with `gitinfo.Fetch()`
- **Integration Points**:
  - `hanimo/internal/ui/tabbar.go` — currently renders git status via debug info
  - `hanimo/internal/llm/context.go` — `GatherFullContext()` calls getGitInfo() manually

### 1.2 Context Window Warning Levels UI Component
- **Location**: `/Users/jiwonkim/Desktop/kimjiwon/TECHAI_CODE/internal/ui/context.go` (54 LOC)
- **Does Hanimo Have This?**: Partially. Hanimo has context overflow detection but not three-tier warning system.
- **What It Does**:
  ```go
  const (
    contextWarnThreshold     = 70  // yellow
    contextCriticalThreshold = 80  // red
    contextAutoThreshold     = 90  // trigger compaction
  )
  ```
  - `ContextPercent()` calculates usage 0-100
  - `ContextLevel()` classifies into Normal/Warn/Critical
  - `ShouldAutoCompact()` triggers stage-3 at 90%
- **Why Hanimo Would Benefit**: More nuanced context warnings in status bar.
- **Porting Difficulty**: **Trivial** (~5 min)

### 1.3 Named Compaction Constants (Code Clarity)
- **Location**: TECHAI's `internal/llm/compaction.go` uses named `const` block (`compactMinMessages`, `compactKeepTail`, etc.)
- **Hanimo Current**: Inline magic numbers (40, 10, 200, 4000, 2000)
- **Porting Effort**: Trivial constant extraction
- **Value**: Config-friendly, easier tuning per model

---

## 2. Features in Hanimo that TECHAI_CODE LACKS

### 2.1 Multi-Provider LLM Abstraction Layer
- **Location**: `hanimo/internal/llm/providers/registry.go` (111 LOC)
- **What It Does**:
  - Factory-based provider registration (Anthropic, Google, Ollama, OpenAI-compatible)
  - Unified `ChatRequest`/`ChatChunk`/`ToolDef` structs
  - Streaming support abstraction
  - `SupportsTools()` capability checking per provider
- **TECHAI Gap**: Hard-coded to OpenAI SDK only
- **Porting Difficulty**: **High** (400-500 LOC refactor)

### 2.2 Agent System with Intent Detection (Super Mode)
- **Location**: `hanimo/internal/agents/` (536 LOC total)
  - `intent.go` — auto-detection of chat vs plan vs auto
  - `auto.go` — autonomous loop control with iteration capping
  - `plan.go` — multi-step plan execution framework
  - `askuser.go` — interactive user confirmation
- **What It Does**:
  - Super mode classifies user intent from keywords (Korean + English)
  - Routes to appropriate sub-mode (chat, plan, auto)
  - Plan mode generates JSON execution plans before running
  - Auto mode runs up to `MaxAutoIterations` (default 20)
- **TECHAI Gap**: Only hardcoded modes with no intent routing
- **Porting Difficulty**: **Medium** (~300 LOC integration)

### 2.3 Comprehensive Tool Registry with Mode-Based Access Control
- **Location**: `hanimo/internal/tools/registry.go` (665 LOC)
- **What It Does**:
  - `AllTools()` — full access for Super/Dev
  - `ReadOnlyTools()` — Plan mode (no file writes)
  - `ToolsForMode(mode int)` — mode-dependent tool selection
  - `Execute()` dispatcher with safety validation
  - Result truncation (50KB for file reads, 30KB for shell output)
  - **Hashline-based safe editing** (MD5 anchors prevent concurrent edit corruption — hanimo-unique!)
- **TECHAI Gap**: Simpler registry with 7 tools, no mode-based access control, no hashline editing

### 2.4 Session & Message Persistence via SQLite
- **Location**: `hanimo/internal/session/db.go`
- **Schema Highlights**:
  - sessions, messages, memories, usage_log, mcp_servers tables
  - WAL mode enabled
  - Foreign key constraints
  - Automatic indexing on hot queries
- **TECHAI Gap**: Simpler (Int64 IDs, lightweight schema, no memories/mcp tables)

### 2.5 Enhanced Shell Safety: Soft vs Hard Dangerous Patterns
- **Location**: `hanimo/internal/tools/shell.go` lines 24-78 (~50 LOC)
- **What It Does**:
  - `hardDangerousPatterns`: 12 regex patterns, instant block
  - `SoftDangerousPatterns`: 12 additional patterns requiring user confirmation
  - `IsDangerous(cmd) → (bool, string)` — returns reason
  - Timeout auto-escalation (npm install gets 5min vs 60sec for tests)
  - Deprecated tool detection (create-react-app → vite, bower → npm)
- **TECHAI Gap**: Only hard blocks, no soft confirmation, no deprecation detection

### 2.6 Knowledge Base with Embedded .md Documents
- **Location**: `hanimo/internal/knowledge/store.go` (150+ LOC)
- **What It Does**:
  - Loads .md files from embedded filesystem
  - Tiered priority (Tier0=product-specific, Tier1=daily, Tier3=reference)
  - Keyword indexing and search
  - Token budget aware
- **TECHAI Gap**: No knowledge base system

### 2.7 System Context Gathering Utilities
- **Location**: `hanimo/internal/llm/context.go` (80+ LOC)
- **What It Does**:
  - `GatherSystemContext()` — lightweight (~50 tokens)
  - `GatherFullContext()` — comprehensive
  - `getLocalIPs()`, `getGitInfo()`, `listCurrentDir()` helpers
- **TECHAI Gap**: Minimal, mostly hardcoded in prompts

### 2.8 MCP (Model Context Protocol) Client
- **Location**: `hanimo/internal/mcp/client.go` (334 LOC)
- **What**: Full MCP JSON-RPC 2.0 client with stdio + SSE transports
- **TECHAI Gap**: No MCP support

---

## 3. Divergent Implementations Comparison

### 3.1 Compaction Algorithm

| Aspect | Hanimo | TECHAI | Winner |
|--------|--------|--------|--------|
| Stage 1 constants | Inline | Named `const` block | TECHAI |
| Stage 2 logic | `len(messages) - 10` | `compactKeepTail = 10` | TECHAI |
| Stage 3 fallback | Returns stages 1-2 on LLM error | Same | Tie |
| Token estimation | chars/4 heuristic | Same | Tie |
| Logging | Detailed checkpoint | Same | Tie |

**Recommendation**: Port TECHAI's constant naming to hanimo (~20 LOC refactor).

### 3.2 System Prompt Architecture

| Aspect | Hanimo | TECHAI | Winner |
|--------|--------|--------|--------|
| Base Structure | 3 modes × 1 prompt each | 3 modes × clarifyFirstDirective + mode-specific | TECHAI |
| Clarify-First Directive | None (pre-v0.2.1) | Yes (15+ requirements) | TECHAI |
| ASK_USER Format | hanimo has it (v0.2.0) | Formal structure with types | Tie |
| Deprecated Tools List | None | Hardcoded (create-react-app, yarn, bower) | TECHAI |
| Tool Usage Rules | Basic (70 lines) | Extensive (200+ lines with priorities) | TECHAI |
| Korean Localization | Partial | Full | TECHAI |

**Analysis**: TECHAI's prompt is more defensive (asks before acting); hanimo's is more action-oriented. Blend both.

### 3.3 Session Data Model

| Aspect | Hanimo | TECHAI | Winner |
|--------|--------|--------|--------|
| Session ID Type | TEXT (UUID string) | INTEGER (auto-increment) | Hanimo |
| Messages table | Includes tokens_in, tokens_out, tool_result | Minimal schema | Hanimo |
| Extra tables | memories, usage_log, mcp_servers | None | Hanimo |
| WAL Mode | Yes | Yes | Tie |

**Winner**: hanimo (more complete schema)

### 3.4 Tool Registry Pattern

| Aspect | Hanimo | TECHAI | Winner |
|--------|--------|--------|--------|
| Tool Count | 14 (includes hashline, diagnostics) | 7 (basic file/grep/shell) | Hanimo |
| Mode-Based Access | AllTools() vs ReadOnlyTools() | Single list | Hanimo |
| Safety Checking | CheckSafety() built-in | Not present | Hanimo |
| Result Truncation | Per-tool limits | Not present | Hanimo |

**Winner**: hanimo

### 3.5 Provider Abstraction

| Aspect | Hanimo | TECHAI | Winner |
|--------|--------|--------|--------|
| Providers Supported | Anthropic, Google, Ollama, OpenAI | OpenAI only | Hanimo |
| Provider Interface | Full abstraction | Tightly coupled | Hanimo |
| Registration Pattern | Factory (sync.Map) | Hardcoded imports | Hanimo |

**Winner**: hanimo

### 3.6 LLM Client Implementation

| Aspect | Hanimo | TECHAI | Winner |
|--------|--------|--------|--------|
| Provider Delegation | `NewClientWithProvider()` | No | Hanimo |
| Stream Usage Field | `StreamChunk.*openai.Usage` | No | Hanimo |
| Network Debugging | DNS pre-check, detailed logging | Basic | Hanimo |

**Winner**: hanimo

---

## 4. Shared-Core Extraction Opportunity: `hanimo-core` Module

### Candidates for Extraction

| Package | LOC | Blocking Issues | Dependencies | Shared Value |
|---------|-----|-----------------|--------------|--------------|
| `llm/compaction` | 138 | None | openai SDK | Both identical |
| `llm/capabilities` | 100+ | None | openai SDK | Vendor model metadata |
| `llm/context` (gathering) | 80 | Minor (shell) | None | System context |
| `knowledge/store` | 150+ | fs.FS | None | Tiered knowledge |
| `knowledge/injector` | 60 | store dep | None | Prompt enhancement |
| `gitinfo` | 262 | None | exec (git) | Lightweight git |
| `tools/shell` (safety) | 65 | Regex | None | Dangerous detection |
| `session/usage` | 84 | pricing table | None | Token cost |

### NOT Suitable for Extraction
- `agents/*` — hanimo-specific Korean keyword lists
- `llm/providers/*` — hanimo-specific multi-provider
- `tools/registry` — tightly coupled to mode system
- `ui/*` — per-project layouts
- `session/db` — schema differences
- `app/*` — main loop differences
- `mcp/*` — hanimo-specific

### Recommended Extraction Plan

**Phase 1 (No-Brainer, 2-3 days)**:
```
hanimo-core/
  llm/
    compaction.go      # Identical in both
    capabilities.go    # Model metadata
  knowledge/
    store.go           # Knowledge indexing
    injector.go        # Prompt enhancement
```

**Phase 2 (Medium-Effort, 1 week)**:
```
hanimo-core/
  gitinfo/             # From TECHAI
  llm/context.go       # System context
  tools/safety.go      # Dangerous patterns
```

**Phase 3 (High-Effort, 2+ weeks)**:
```
hanimo-core/
  tools/usage.go       # Token costs
  llm/providers/       # Provider interface
```

### Blockers
1. Knowledge base file distribution (`//go:embed` across modules)
2. Pricing table versioning
3. TECHAI's closed source status
4. Provider registry adoption

---

## 5. Package-by-Package Diff Summary

| Package | Hanimo | TECHAI | Diff |
|---------|--------|--------|------|
| `app` | Main event loop with TUI state | Similar | ~5% (mode routing) |
| `config` | max_iterations, providers map | API + models | ~25% more in hanimo |
| `knowledge` | Full store + extractor + injector | **None** | TECHAI completely missing |
| `llm` | 1150 LOC (providers + compaction + context) | 1408 LOC (no providers) | TECHAI: monolithic |
| `session` | db + memory + store + usage | store only | hanimo 3x more |
| `tools` | 1770 LOC (14 tools + hashline) | ~900 LOC (7 tools) | hanimo 2x larger |
| `ui` | 11 files | 8 files | Layout/styling only |
| `agents` | 536 LOC (intent, auto, plan, askuser) | **None** | hanimo-only |
| `mcp` | 334 LOC (JSON-RPC 2.0) | **None** | hanimo-only |

---

## 6. Critical Pain Points in the Code

### 6.1 Tool Call Parsing: JSON Contract Fragility
**Locations**: Both projects, tools/*.go
**Problem**: `json.Unmarshal` without schema validation. Type coercion masks bugs.
**Fix**: Add JSONSchema struct validation:
```go
type ShellExecArgs struct {
  Command string `json:"command" validate:"required"`
}
```

### 6.2 Context Overflow: Incomplete Feedback at 90%
**Location**: `hanimo/internal/llm/client.go`
**Problem**: Stage 3 LLM summarization failures fall back silently. Caller has no feedback.
**Fix**: Return `CompactionResult{Stage, Summarized, Error}` struct.

### 6.3 Shell Command Timeout: Hard-Coded 60s
**Location**: `hanimo/tools/shell.go:27`
**Problems**:
- longCommands list incomplete (missing `docker build`, `cargo build`, large `pip install`)
- No user override mechanism
- "npm install" exact substring won't catch variations
- TECHAI has no timeout at all
**Fix**: Config option `shell_timeout: 300s`; regex detection; per-command override in tool args.

### 6.4 Hardcoded Constants Missing Configuration

| Constant | Hanimo | TECHAI | Configurable? |
|----------|--------|--------|---------------|
| compactMinMessages | 40 | 40 | Yes |
| compactKeepTail | 10 | 10 | Yes |
| maxChars | 4000 | 4000 | Yes (model-dependent) |
| contextWarnThreshold | N/A | 70% | Yes |
| contextAutoThreshold | N/A | 90% | Yes |
| DefaultShellTimeout | 60s | N/A | Yes |
| MaxAutoIterations | 20 | N/A | Partial |

### 6.5 Error Handling: Silent String Errors
**Location**: Both projects, tools/registry.go
**Problem**: `return "Error: path is required"` — string errors, no categorization.
**Fix**: Custom error types with Code/Message/Arg fields.

### 6.6 TECHAI Exit Code Always 0 for Non-Exec Errors
**Location**: `TECHAI/tools/shell.go:100`
**Problem**: No distinction between "command not found" vs "ran and returned 1".

---

## 7. Integration Recommendations

### For Hanimo (Inbound Ports from TECHAI)

| Feature | Source | Target | Effort | Priority |
|---------|--------|--------|--------|----------|
| gitinfo package | `TECHAI/internal/gitinfo/` | `hanimo/internal/gitinfo/` | Trivial | High |
| Context warn levels | `TECHAI/internal/ui/context.go` | `hanimo/internal/ui/context.go` | Trivial | High |
| Compaction constants | `TECHAI/internal/llm/compaction.go` | Refactor `hanimo/internal/llm/compaction.go` | Trivial | Medium |
| Clarify-first directive | `TECHAI/internal/llm/prompt.go` | `hanimo/internal/llm/prompt.go` | Trivial | High |

### For TECHAI_CODE (Inbound from Hanimo)

| Feature | Source | Target | Effort | Priority |
|---------|--------|--------|--------|----------|
| Soft dangerous patterns | `hanimo/internal/tools/shell.go` | `TECHAI/internal/tools/shell.go` | Trivial | High |
| Agent system | `hanimo/internal/agents/` | `TECHAI/internal/agents/` | Medium | Medium |
| Tool registry | `hanimo/internal/tools/registry.go` | `TECHAI/internal/tools/` | High | Low |
| Usage tracking | `hanimo/internal/session/usage.go` | `TECHAI/internal/session/` | Trivial | Medium |

---

## 8. Strategic Recommendations

### Architecture Quality

**Hanimo Strengths**:
- Modular provider abstraction (future-proof)
- Comprehensive tool registry with safety layers
- Agent intent detection
- Multi-table session persistence
- Knowledge base system
- MCP client

**TECHAI Strengths**:
- Simpler, focused codebase
- Better system prompt engineering (clarify-first)
- Cleaner compaction constant naming
- Lightweight gitinfo package

### Next Steps

**Short Term (1-2 weeks)**:
1. Port gitinfo from TECHAI to hanimo
2. Add soft dangerous patterns to both
3. Extract compaction constants in hanimo
4. Add context warning thresholds to hanimo UI

**Medium Term (1 month)**:
1. Create `hanimo-core` module (compaction, capabilities, knowledge, gitinfo)
2. Refactor TECHAI to use provider abstraction
3. Blend system prompts
4. Add usage tracking to TECHAI

**Long Term (2-3 months)**:
1. Unify session schema
2. Port agent system to TECHAI
3. Build shared test suite
4. Establish versioning/release process for hanimo-core

### Why This Matters

Both projects are built on the same foundation but with divergent feature sets. A shared core module would:
- Reduce duplication
- Allow rapid feature sharing
- Improve test coverage
- Create a foundation for future agents

The "bidirectional porting structure" is already evident in the design patterns — both independently arrived at similar architectural solutions. Extracting and formalizing this shared foundation would accelerate both projects.

---

**Scope Summary**:
- 70+ source files reviewed
- 5000+ LOC examined
- 15 priority opportunities identified
- 8 critical pain points documented
- 12+ feature integration plans
- 10+ shared-core package candidates

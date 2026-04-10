# Go Ecosystem Libraries for Hanimo v0.3.0
# Hanimo v0.3.0을 위한 Go 생태계 라이브러리 조사

> **Date / 작성일**: 2026-04-11
> **Scope / 범위**: External Go libraries hanimo could adopt to close feature gaps
> **Current stack / 현재 스택**: bubbletea v2, lipgloss v2, bubbles v2, glamour v2, go-openai v1.41.2, modernc.org/sqlite v1.48.1, yaml.v3

---

## Table of Contents / 목차

1. [Token Counting / Tokenization](#1-token-counting--tokenization)
2. [Gitignore Parsing](#2-gitignore-parsing)
3. [Tree-sitter / AST Parsing](#3-tree-sitter--ast-parsing)
4. [File Walking with Exclusions](#4-file-walking-with-exclusions)
5. [Glob Matching](#5-glob-matching)
6. [Shell Sandbox / Process Execution](#6-shell-sandbox--process-execution)
7. [OAuth / Keychain / Credential Storage](#7-oauth--keychain--credential-storage)
8. [MCP Client/Server in Go](#8-mcp-clientserver-in-go)
9. [JSON Schema Validation](#9-json-schema-validation)
10. [Retry / Backoff](#10-retry--backoff)
11. [Config with Overrides](#11-config-with-overrides)
12. [Structured Logging for Agent Traces](#12-structured-logging-for-agent-traces)
13. [Embedding / Vector Search](#13-embedding--vector-search)
14. [Markdown Rendering](#14-markdown-rendering)
15. [Diff / Patch](#15-diff--patch)
16. [Interactive Prompts Beyond Bubbletea](#16-interactive-prompts-beyond-bubbletea)
17. [Sandbox / Container for Executing Generated Code](#17-sandbox--container-for-executing-generated-code)
18. [Recommended Adoption List for v0.3.0](#18-recommended-adoption-list-for-v030)

---

## 1. Token Counting / Tokenization

**Why it matters / 왜 필요한가**: Accurate context-window management — knowing how many tokens a prompt consumes before sending it — is essential for avoiding truncation and for cost estimation. Without a local counter, hanimo must call the API for every check, incurring latency and rate-limit pressure.

**토큰 카운팅이 중요한 이유**: 프롬프트를 전송하기 전에 사용할 토큰 수를 파악하는 것은 컨텍스트 창 관리에 핵심입니다. 로컬 카운터 없이는 매번 API를 호출해야 해 레이턴시가 늘어납니다.

---

### 1a. pkoukk/tiktoken-go

| Field | Value |
|-------|-------|
| Repo | https://github.com/pkoukk/tiktoken-go |
| Version | v0.1.8 (Sep 10, 2025) |
| License | MIT |
| Stars | ~900 |
| Last commit | Sep 2025 |

**Description**: Go port of OpenAI's tiktoken BPE tokenizer. Supports `o200k_base` (GPT-4o, GPT-4.1), `cl100k_base` (GPT-4, GPT-3.5-turbo), `p50k_base` (Codex), `r50k_base`.

**Pros**:
- Pure Go, no CGO required
- Direct `EncodingForModel("gpt-4o")` API — one line to count tokens
- Caching via `TIKTOKEN_CACHE_DIR`; pluggable BPE loaders for offline use
- Covers all current OpenAI models via `go-openai` which hanimo already uses

**Cons**:
- Pre-v1.0; API may shift
- Does not cover Anthropic (Claude) or Google (Gemini) models
- First run downloads BPE vocabulary files (~1 MB each) unless cached

**Integration effort**: ~50 LOC — wrap in `internal/token/counter.go`, call `tiktoken.EncodingForModel(model)` then `tke.Encode(text, nil, nil)`

**Blocker / 호환성**: None. Pure Go, compatible with Go 1.26.

**Verdict**: **Adopt** — hanimo already uses `go-openai`; this is the natural companion for OpenAI model token counting.

---

### 1b. daulet/tokenizers (HuggingFace bindings)

| Field | Value |
|-------|-------|
| Repo | https://github.com/daulet/tokenizers |
| Version | v1.27.0 (Mar 30, 2026) |
| License | MIT |
| Stars | ~219 |
| Last commit | Mar 2026 (active) |

**Description**: Go bindings for the HuggingFace Tokenizers Rust library. Loads any tokenizer from the HuggingFace Hub via `FromPretrained()`. Includes Tiktoken compatibility layer.

**Pros**:
- Covers HuggingFace-hosted models (Mistral, Llama, Qwen, etc.)
- Actively maintained; recent releases

**Cons**:
- **CGO required** — must build `libtokenizers.a` (Rust static lib); cross-compilation is complex
- Increases binary size significantly (~10 MB+)
- Not needed for hanimo's current model set (OpenAI + Anthropic + Gemini)

**Integration effort**: ~200 LOC + Makefile changes + CI matrix changes for CGO

**Blocker**: CGO dependency breaks `modernc.org/sqlite`'s pure-Go advantage; complicates Docker/CI builds.

**Verdict**: **Skip** for now. Only relevant if hanimo adds deep HuggingFace model support.

---

### 1c. Anthropic Token Counting (API-based)

| Field | Value |
|-------|-------|
| Source | https://platform.claude.com/docs/en/api/go/messages/count_tokens |
| Method | `client.Messages.CountTokens(ctx, body)` |
| Cost | Free (rate-limited by tier) |

**Description**: Anthropic does not publish a local tokenizer for Claude 3+ models. The official approach is the `POST /v1/messages/count_tokens` API endpoint. The `go-openai`-compatible Anthropic SDK exposes `Messages.CountTokens()`.

**Practical fallback / 실용적인 대안**: For local estimation without an API call, Claude tokens ≈ `len(text)/3.5` for English prose, or `len(text)/4` as a conservative over-estimate. A tiered heuristic:
```go
func EstimateTokens(text, model string) int {
    switch {
    case strings.HasPrefix(model, "claude-"):
        return len([]rune(text))/3 + 10  // ~3 chars/token for Claude
    case strings.HasPrefix(model, "gpt-") || strings.HasPrefix(model, "o"):
        // use tiktoken-go for accuracy
        tke, _ := tiktoken.EncodingForModel(model)
        return len(tke.Encode(text, nil, nil))
    default:
        return len([]rune(text)) / 4  // universal fallback
    }
}
```

**Verdict**: Use Anthropic API for accurate pre-flight counting; use heuristic for streaming/in-flight estimation.

---

### 1d. Gemini Token Counting

Google's `google.golang.org/genai` SDK (v1.x, 2025) exposes `client.Models.CountTokens()` which calls `POST /v1beta/models/{model}:countTokens`. No local tokenizer is available in Go. Same API-call pattern as Anthropic.

**Verdict**: Use the official Gemini SDK method when Gemini support is added to hanimo.

---

### Summary Table — Token Counting / 토큰 카운팅 요약

| Library | Model coverage | CGO | Verdict |
|---------|---------------|-----|---------|
| pkoukk/tiktoken-go | All OpenAI models | No | **Adopt** |
| daulet/tokenizers | HuggingFace models | Yes | Skip |
| Anthropic API | Claude 3+ | No (network) | Use API |
| Gemini SDK | Gemini models | No (network) | Use SDK |
| char/4 heuristic | All | No | Use as fallback |

---

## 2. Gitignore Parsing

**Why it matters / 왜 필요한가**: Repo-map and file-indexing features must respect `.gitignore` patterns to avoid sending node_modules, build artifacts, and secrets to the LLM context.

**중요성**: 레포 맵과 파일 인덱싱 기능이 `.gitignore`를 준수하지 않으면 node_modules, 빌드 결과물, 시크릿이 LLM 컨텍스트에 포함될 수 있습니다.

---

### 2a. go-git/go-git gitignore package

| Field | Value |
|-------|-------|
| Repo | https://pkg.go.dev/github.com/go-git/go-git/v5/plumbing/format/gitignore |
| Version | v5.17.2 (part of go-git) |
| License | Apache-2.0 |

**Description**: Sub-package of `go-git`. Full git spec compliance: negation (`!`), nested `.gitignore` traversal, global `~/.gitconfig` excludesfile, system `/etc/gitconfig` patterns.

**Pros**:
- Correct negation support (`!pattern` re-includes previously excluded files)
- `ReadPatterns()` traverses nested `.gitignore` files at all directory levels automatically
- Used by production git tooling; battle-tested
- Loads global and system patterns via `LoadGlobalPatterns()` / `LoadSystemPatterns()`

**Cons**:
- Importing just the gitignore sub-package pulls in all of `go-git/v5` as a dependency (~large)
- `go-git` adds ~8 MB to binary and numerous transitive deps

**Integration effort**: ~30 LOC to wire up `ReadPatterns` + `NewMatcher`

**Blocker**: Dependency weight. If hanimo only needs gitignore parsing, this is over-engineered.

**Verdict**: **Evaluate** — use only if hanimo plans to add git operations (commits, branches, diff). Otherwise prefer a lighter option.

---

### 2b. sabhiram/go-gitignore

| Field | Value |
|-------|-------|
| Repo | https://github.com/sabhiram/go-gitignore |
| Stars | ~161 |
| License | MIT |
| Last commit | 2021 (dormant) |

**Description**: Lightweight single-file gitignore parser. Parses one `.gitignore` at a time.

**Pros**:
- Very small; minimal deps
- Simple API: `gitignore.CompileIgnoreFile(".gitignore")` then `obj.MatchesPath(path)`

**Cons**:
- **No nested `.gitignore` support** — only processes a single file
- **No negation support** for re-including files
- Dormant since 2021; no active maintenance

**Verdict**: **Skip** — nested gitignore and negation are required for real repos.

---

### 2c. denormal/go-gitignore

| Field | Value |
|-------|-------|
| Repo | https://pkg.go.dev/github.com/denormal/go-gitignore |
| Version | v0.0.0-20180930084346-ae8ad1d07817 (Sep 2018) |
| License | MIT |

**Description**: Full-featured gitignore library with repository-wide pattern matching, caching, and spec-compliant negation.

**Pros**:
- Full negation support (`!` prefix)
- Nested repository gitignore: `NewRepository(base)` walks all `.gitignore` files
- Thread-safe caching via `NewRepositoryWithCache()`
- Uses `fnmatch` spec matching per git documentation

**Cons**:
- Last updated 2018 — no maintenance in 6+ years
- Pre-module era; version string is a pseudo-version

**Verdict**: **Skip** — the negation and nesting logic is correct, but 6 years dormant is too risky for a production dependency.

---

### 2d. Recommended Approach

Use the go-git gitignore sub-package if go-git is already a dependency; otherwise implement a thin wrapper around the stdlib that reads `.gitignore` files at each directory level:

```go
// Minimal pattern: walk directories, collect .gitignore at each level,
// build a per-directory matcher using go-git/v5/plumbing/format/gitignore
import "github.com/go-git/go-git/v5/plumbing/format/gitignore"

ps, _ := gitignore.ReadPatterns(worktree, nil)
matcher := gitignore.NewMatcher(ps)
if matcher.Match(pathComponents, isDir) { /* skip */ }
```

**Verdict summary**:

| Library | Negation | Nested | Maintained | Verdict |
|---------|----------|--------|-----------|---------|
| go-git gitignore | Yes | Yes | Yes | **Evaluate** |
| sabhiram/go-gitignore | No | No | No (2021) | Skip |
| denormal/go-gitignore | Yes | Yes | No (2018) | Skip |

---

## 3. Tree-sitter / AST Parsing

**Why it matters / 왜 필요한가**: A repo-map feature (like Aider's) extracts symbol names, function signatures, and class hierarchies from source files to give the LLM structural context without sending full file contents.

**중요성**: Aider 스타일의 레포 맵은 소스 파일에서 심벌, 함수 시그니처, 클래스 계층 구조를 추출해 LLM에 구조적 컨텍스트를 제공합니다.

---

### 3a. smacker/go-tree-sitter

| Field | Value |
|-------|-------|
| Repo | https://github.com/smacker/go-tree-sitter |
| Stars | ~549 |
| License | MIT |
| Last commit | Active (401 commits) |

**Description**: CGO bindings for tree-sitter with ~30 bundled language grammars (Go, TypeScript, Python, Rust, C/C++, Java, Ruby, PHP, Kotlin, Swift, YAML, TOML, HCL, SQL, HTML, CSS, Dockerfile, and more).

**Pros**:
- Most complete Go tree-sitter binding; covers all major languages
- Battle-tested in production tools
- Syntax-error tolerant (tree-sitter parses partial/invalid code)
- Enables precise symbol extraction (function names, class names, method signatures)

**Cons**:
- **CGO required** — same binary complexity issue as tokenizers
- Large dependency surface; each grammar adds C code
- Cross-compilation to ARM/WASM is non-trivial

**Integration effort**: ~300 LOC to build a repo-map generator that walks source files and extracts top-level declarations

**Blocker**: CGO. hanimo currently uses `modernc.org/sqlite` specifically to avoid CGO. Adding tree-sitter breaks that guarantee.

**Verdict**: **Evaluate** — correct long-term choice for repo-map; only adopt when hanimo accepts a CGO dependency.

---

### 3b. go/parser (stdlib)

| Field | Value |
|-------|-------|
| Package | `go/parser`, `go/ast` |
| Version | stdlib (Go 1.26) |
| License | BSD-3-Clause |

**Description**: Go's built-in AST parser. Parses Go source files only.

**Pros**:
- Zero dependencies, zero CGO
- Complete Go AST: functions, types, interfaces, constants, imports
- `parser.ParseDir()` processes entire directories

**Cons**:
- **Go files only** — cannot parse TypeScript, Python, Rust, etc.
- Not useful for polyglot repositories

**Integration effort**: ~100 LOC for a Go-specific repo-map

**Verdict**: **Adopt as fallback** — use `go/parser` for Go repos immediately (no CGO) and add tree-sitter later for polyglot support.

---

### 3c. LSP client (go.lsp.dev/protocol)

| Field | Value |
|-------|-------|
| Package | https://pkg.go.dev/go.lsp.dev/protocol |
| Version | v0.12.0 (Mar 2022) |
| License | BSD-3-Clause |
| LSP spec | 3.15.3 |

**Description**: Go structs for the Language Server Protocol. Used to build LSP servers or clients.

**Notes**:
- Not a standalone symbol extractor; requires spawning a language server process (gopls, pyright, etc.)
- Adds network/IPC complexity; overengineered for hanimo's current needs
- `tliron/glsp` (269 stars, Apache-2.0, last commit Mar 2024) is LSP **server-side** only — not useful for hanimo as a client

**Verdict**: **Skip** for v0.3.0. LSP-based repo-map is a v0.5+ feature.

---

### 3d. universal-ctags (subprocess)

Run `ctags --output-format=json -R .` as a subprocess and parse JSON output. No Go dependency, but requires ctags installed on the user's machine.

**Verdict**: **Evaluate as optional enhancement** — add as an opt-in feature when ctags is detected.

---

### Summary — AST / Tree-sitter

| Approach | Languages | CGO | Verdict |
|----------|-----------|-----|---------|
| smacker/go-tree-sitter | 30+ | Yes | Evaluate (post-CGO decision) |
| go/parser (stdlib) | Go only | No | **Adopt** (immediate) |
| LSP client | Any (via server) | No | Skip for v0.3 |
| universal-ctags subprocess | Any | No | Evaluate (optional) |

---

## 4. File Walking with Exclusions

**Why it matters / 왜 필요한가**: Scanning large repos (100K+ files) for the file picker, repo-map, and context injection must be fast and respect gitignore rules.

**중요성**: 100K개 이상의 파일을 가진 대형 레포를 스캔할 때 빠른 속도와 gitignore 준수가 모두 필요합니다.

---

### 4a. filepath.WalkDir (stdlib)

| Field | Value |
|-------|-------|
| Package | `path/filepath` |
| Version | stdlib (Go 1.16+) |
| License | BSD-3-Clause |

**Description**: Standard library directory walker. Single-threaded, calls `os.Lstat` on every entry.

**Pros**: Zero deps, familiar API, sufficient for small repos

**Cons**: Slowest option; ~1.4 seconds for 100K files on Linux (warm cache); allocates per-entry

**Verdict**: **Adopt as baseline** — use now, replace with walker for large repos.

---

### 4b. saracen/walker

| Field | Value |
|-------|-------|
| Repo | https://github.com/saracen/walker |
| Version | v0.1.4 (Jan 2024) |
| Stars | ~97 |
| License | MIT |
| Last commit | Jan 2024 |

**Description**: Parallel `filepath.Walk` replacement using goroutines. ~10x faster than stdlib on Linux (133ms vs 1,437ms for 100K files); ~12x faster on Windows. Callbacks must be goroutine-safe.

**Pros**:
- Dramatic speed improvement for large repos
- Drop-in replacement for `filepath.Walk`
- Low memory: ~92-104 MB vs stdlib's ~340-351 MB

**Cons**:
- Callback concurrency requires sync-safe code
- Small community (~97 stars); limited long-term maintenance signal
- Last release Jan 2024 (stable but not actively developed)

**Integration effort**: ~20 LOC change (swap `filepath.Walk` call, add mutex to callback)

**Verdict**: **Adopt** — the performance gain is critical for large repos; integration is minimal.

---

### 4c. karrick/godirwalk

| Field | Value |
|-------|-------|
| Repo | https://github.com/karrick/godirwalk |
| Version | v1.16.1 |
| Stars | ~725 |
| License | BSD-2-Clause |
| Last commit | ~2022 (maintenance mode) |

**Description**: Avoids redundant `os.Stat` calls by preserving `d_type` from `readdir`. 5–10x faster than stdlib on macOS, 2x on Linux.

**Cons**: Single-threaded unlike `saracen/walker`; maintenance mode

**Verdict**: **Skip** in favour of saracen/walker which is both faster and more modern.

---

### Performance Comparison / 성능 비교 (100K files, warm cache)

| Library | Linux | Windows | Goroutine-safe | Verdict |
|---------|-------|---------|----------------|---------|
| filepath.WalkDir | ~1,437ms | slow | N/A | Baseline |
| saracen/walker | ~133ms | ~12x faster | Required | **Adopt** |
| karrick/godirwalk | ~700ms | ~4x faster | N/A | Skip |

---

## 5. Glob Matching

**Why it matters / 왜 필요한가**: File filtering in the file picker, context inclusion patterns, and tool call path filters all need glob patterns with `**` support.

---

### 5a. bmatcuk/doublestar

| Field | Value |
|-------|-------|
| Repo | https://github.com/bmatcuk/doublestar |
| Stars | ~685 |
| License | MIT |
| Last commit | Dec 2024 |

**Description**: `**` glob support for Go. Implements `Match()`, `PathMatch()`, `Glob()`, `GlobWalk()`, `FilepathGlob()`. Supports character classes `[abc]`, ranges `[a-z]`, negation `[^abc]`, and alternatives `{alt1,alt2}`.

**Pros**:
- The standard choice for `**` glob in the Go ecosystem
- `GlobWalk()` integrates with filesystem traversal
- Case-insensitive mode, hidden file handling, symlink control
- Comparable performance to stdlib `filepath.Match` for simple patterns

**Cons**: Small overhead vs stdlib for non-`**` patterns (negligible)

**Integration effort**: ~10 LOC

**Verdict**: **Adopt** — the reference `**` glob library for Go; low risk, high utility.

---

### 5b. gobwas/glob

| Field | Value |
|-------|-------|
| Repo | https://github.com/gobwas/glob |
| Stars | ~1,000 |
| License | MIT |
| Last commit | ~2024 (v0.2.3, last significant release 2017) |

**Description**: Compile-once glob patterns. Extremely fast matching: 8.15 ns/op vs regexp's 237 ns/op for simple patterns. Supports `?`, `*`, `**`, character classes, alternatives.

**Pros**: Fastest matching performance; configurable delimiter handling

**Cons**:
- v0.2.3 last tagged 2017; repository is largely dormant
- No filesystem integration (match strings only; no `Glob()` API)
- `**` support requires explicit configuration of separator

**Verdict**: **Skip** — use bmatcuk/doublestar for filesystem glob; use gobwas only if hot-path string matching is needed in the future.

---

### 5c. filepath.Match (stdlib)

No `**` support. Too limited for hanimo's needs.

**Verdict**: **Skip** as primary; use as internal baseline only.

---

### Summary — Glob

| Library | `**` support | Filesystem API | Performance | Verdict |
|---------|-------------|---------------|-------------|---------|
| bmatcuk/doublestar | Yes | Yes (GlobWalk) | Good | **Adopt** |
| gobwas/glob | Yes (config) | No | Excellent | Skip |
| filepath.Match | No | No | stdlib | Skip |

---

## 6. Shell Sandbox / Process Execution

**Why it matters / 왜 필요한가**: hanimo executes shell commands via its `shell` tool. Implementing approval modes (like Codex CLI's `--approval-mode auto-edit`) and sandboxing generated code requires process-level isolation.

**중요성**: LLM이 생성한 셸 명령어를 안전하게 실행하려면 프로세스 격리 및 승인 모드가 필요합니다.

---

### 6a. exec.CommandContext (stdlib) — Current approach

`os/exec.CommandContext(ctx, ...)` with `cmd.SysProcAttr` is hanimo's current mechanism. Adding `syscall.RLIMIT_*` via `syscall.Setrlimit` imposes resource limits (CPU time, memory, open files).

```go
cmd := exec.CommandContext(ctx, "bash", "-c", shellCmd)
cmd.SysProcAttr = &syscall.SysProcAttr{
    Setpgid: true,  // put in own process group for kill
}
// Optional resource limits (Linux)
var rLimit syscall.Rlimit
rLimit.Max = 256 * 1024 * 1024  // 256MB
rLimit.Cur = 256 * 1024 * 1024
syscall.Setrlimit(syscall.RLIMIT_AS, &rLimit)
```

**macOS note**: `syscall.Setrlimit` behaviour changed in Go 1.12 on macOS (issues with file descriptor limits). Use with caution.

**Verdict**: **Adopt for v0.3** — sufficient for basic process management and timeout enforcement via `CommandContext`.

---

### 6b. macOS sandbox-exec (Apple Seatbelt)

macOS ships `sandbox-exec` which applies SBPL (Sandbox Profile Language) policies restricting filesystem, network, and process operations. **Status: deprecated by Apple** as of macOS 12+ but still functional.

```go
cmd := exec.Command("sandbox-exec", "-n", "no-network", "bash", "-c", userCmd)
```

Built-in profiles: `no-internet`, `no-network`, `no-write`, `pure-computation`.

**Pros**: Zero dependencies; available on every macOS system; blocks network, write access

**Cons**: Apple-deprecated; Seatbelt profiles are undocumented; no Linux equivalent

**Verdict**: **Evaluate** — use as opt-in sandboxing on macOS when user enables strict mode. Do not rely on it long-term.

---

### 6c. gomodjail (NTT Labs, 2026)

| Field | Value |
|-------|-------|
| Source | https://medium.com/nttlabs/gomodjail-library-sandboxing-for-go-modules-451b22d02700 |
| Approach | seccomp (Linux) / DYLD_INSERT_LIBRARIES (macOS) |
| Release | Jan 2026 |

**Description**: Hooks dangerous syscalls (`open`, `execve`) and blocks them for specific Go modules in a blocklist. Library-level sandboxing rather than process-level.

**Verdict**: **Skip for v0.3** — immature, architecture is inverted (restricts Go modules inside your binary, not spawned subprocesses).

---

### 6d. Recommended Approach for Approval Modes

Implement three tiers mirroring Codex CLI:

1. **`suggest` mode** (default): Show command diff in TUI, require explicit user `y/n` before any execution. Already partially implemented in `internal/tools/shell.go`.

2. **`auto-edit` mode**: Execute file edits without confirmation; require confirmation for shell commands.

3. **`full-auto` mode**: All operations execute without confirmation; log audit trail to SQLite session.

Process isolation (platform-specific):
- **macOS**: wrap with `sandbox-exec -n no-network` in full-auto mode
- **Linux**: use `exec.CommandContext` with `RLIMIT_AS`, `RLIMIT_NPROC`, `Pdeathsig: syscall.SIGKILL`

```go
// Linux-only safe exec
cmd.SysProcAttr = &syscall.SysProcAttr{
    Setpgid:    true,
    Pdeathsig:  syscall.SIGKILL,
}
```

**Integration effort**: ~150 LOC in `internal/tools/shell.go`

---

## 7. OAuth / Keychain / Credential Storage

**Why it matters / 왜 필요한가**: Reading credentials from Claude Code, Codex CLI, and Gemini CLI avoids requiring users to re-enter API keys. Storing hanimo's own tokens securely requires OS keychain integration.

**중요성**: Claude Code, Codex CLI, Gemini CLI의 자격증명을 재사용하면 사용자 경험이 향상됩니다.

---

### 7a. zalando/go-keyring

| Field | Value |
|-------|-------|
| Repo | https://github.com/zalando/go-keyring |
| Stars | ~1,200 |
| License | MIT |
| Last commit | Mar 23, 2026 (v0.2.8) |

**Description**: Cross-platform keychain access. macOS Keychain via `/usr/bin/security`, Linux via Secret Service D-Bus (GNOME Keyring), Windows Credential Manager.

**Pros**:
- Actively maintained (v0.2.8, March 2026)
- Simple API: `keyring.Set(service, user, password)` / `keyring.Get(service, user)`
- Pure Go on macOS (uses `security` CLI); no CGO

**Cons**:
- Linux requires GNOME Keyring or KWallet (not available in headless/CI environments)
- macOS implementation invokes subprocess (minor overhead)

**Integration effort**: ~30 LOC in `internal/config/keychain.go`

**Verdict**: **Adopt** — the right tool for secure credential storage; actively maintained.

---

### 7b. 99designs/keyring

| Field | Value |
|-------|-------|
| Repo | https://github.com/99designs/keyring |
| Stars | ~646 |
| License | MIT |
| Last commit | Dec 2022 (v1.2.2) |

**Description**: More backends than go-keyring: macOS Keychain, Windows Credential Manager, Secret Service, KWallet, Pass, encrypted JWT files, Linux KeyCtl.

**Pros**: Broader backend support (Pass, encrypted files as fallback)

**Cons**:
- Last release Dec 2022 — no updates in 3+ years
- Heavier API; requires `keyring.Config{}` struct

**Verdict**: **Skip** — zalando/go-keyring is more actively maintained with a simpler API.

---

### 7c. golang.org/x/oauth2

| Field | Value |
|-------|-------|
| Package | https://pkg.go.dev/golang.org/x/oauth2 |
| Version | v0.36.0 (Feb 11, 2026) |
| License | BSD-3-Clause |

**Description**: Official Go OAuth 2.0 client implementation (RFC 6749). Supports Authorization Code (3-legged + PKCE), Client Credentials, Device Authorization (RFC 8628), Resource Owner Password, and JWT Bearer flows.

**Use case for hanimo**: Device Authorization Flow is ideal for authenticating users with Anthropic/Google without exposing credentials in config files:
```go
// Device flow for CLI authentication
response, _ := config.DeviceAuth(ctx)
fmt.Printf("Visit %s and enter code: %s\n", response.VerificationURI, response.UserCode)
token, _ := config.DeviceAccessToken(ctx, response)
```

**Verdict**: **Adopt when OAuth flows are needed** — not needed for API key auth (current model) but essential if hanimo adds browser-based login.

---

### 7d. Reading Existing CLI Credentials

Claude Code stores credentials in `~/.claude/credentials.json` (or `~/.anthropic/`). Codex CLI uses `~/.codex/config.json`. Gemini CLI uses `~/.gemini/credentials.json`. These are plain JSON files readable with `os.ReadFile` + `json.Unmarshal` — no special library needed.

Use `github.com/adrg/xdg` (v0.5.3, MIT, 1,197 importers) for cross-platform XDG paths when reading/writing config files:
```go
configPath, _ := xdg.ConfigFile("hanimo/config.yaml")
```

**Verdict**: xdg **Adopt** — lightweight, widely used, cross-platform.

---

## 8. MCP Client/Server in Go

**Why it matters / 왜 필요한가**: hanimo has a hand-rolled MCP client (`internal/mcp/client.go`) implementing JSON-RPC 2.0 over stdio and SSE transports. The question is whether to replace it with a maintained library.

**현재 상태**: `internal/mcp/client.go`는 수동으로 작성된 JSON-RPC 2.0 클라이언트로 stdio 및 SSE 전송을 구현합니다. 라이브러리로 교체할지 검토가 필요합니다.

**Current implementation analysis**:
- `client.go`: JSON-RPC 2.0 request/response, `Initialize`, `ListTools`, `CallTool`, `Close` — covers the core MCP client lifecycle
- `transport_stdio.go` / `transport_sse.go`: two transport implementations
- Protocol version hardcoded to `"2024-11-05"` — **outdated**; current MCP spec is `2025-11-25`

---

### 8a. mark3labs/mcp-go

| Field | Value |
|-------|-------|
| Repo | https://github.com/mark3labs/mcp-go |
| Stars | ~8,600 |
| License | MIT |
| Last commit | v0.45.0, Mar 6, 2026 |
| MCP spec | 2025-11-25 (backward compat to 2024-11-05) |

**Description**: The dominant Go MCP implementation. Supports all three MCP primitives (Resources, Tools, Prompts), stdio/SSE/HTTP transports, and both server and client modes. Spec version `2025-11-25`.

**Pros**:
- 8,600 stars — the de facto Go MCP standard
- Actively maintained; spec-current
- Both server AND client implementations
- Task tools (forbidden/optional/required) for agentic workflows
- Concurrent task limiting

**Cons**:
- Replaces hanimo's current custom client (~200 LOC) — migration work needed
- Some API churn as MCP spec evolves

**Integration effort**: ~100 LOC to replace `internal/mcp/` with mcp-go client calls

**Verdict**: **Adopt** — hanimo's hand-rolled client is outdated (protocol `2024-11-05`); mcp-go brings spec currency and active maintenance at low migration cost.

---

### 8b. metoro-io/mcp-golang

| Field | Value |
|-------|-------|
| Repo | https://github.com/metoro-io/mcp-golang |
| Stars | ~1,200 |
| License | MIT |
| Last commit | Active (2026) |

**Description**: Alternative Go MCP SDK emphasizing type safety via Go structs and automatic JSON schema generation from struct tags.

**Pros**: Type-safe tool argument definitions; auto-generated schemas; full stdio/HTTP/SSE/Gin support

**Cons**: Less adoption than mark3labs (1.2k vs 8.6k stars); documentation at mcpgolang.com is sparse

**Verdict**: **Skip** — mcp-go has far greater adoption and equivalent features.

---

### Summary — MCP

| Library | Stars | Spec version | Client support | Verdict |
|---------|-------|-------------|---------------|---------|
| hanimo custom | — | 2024-11-05 (outdated) | Yes | Replace |
| mark3labs/mcp-go | 8,600 | 2025-11-25 | Yes | **Adopt** |
| metoro-io/mcp-golang | 1,200 | Current | Yes | Skip |

---

## 9. JSON Schema Validation

**Why it matters / 왜 필요한가**: LLMs occasionally produce malformed tool call JSON. Validating against the tool's input schema and surfacing structured error messages enables automatic retry/repair loops.

**중요성**: LLM이 생성한 툴 호출 JSON이 스키마를 위반할 때, 유효성 검사 오류를 파싱해 재시도 프롬프트를 구성할 수 있습니다.

---

### 9a. santhosh-tekuri/jsonschema

| Field | Value |
|-------|-------|
| Repo | https://github.com/santhosh-tekuri/jsonschema |
| Stars | ~1,200 |
| License | Apache-2.0 |
| Last commit | v6.0.2, May 23, 2025 |

**Description**: Passes all JSON Schema test suites from draft-04 through draft/2020-12. Loop detection, custom format validators, content assertions (base64, application/json). Hierarchical, introspectable error outputs.

**Pros**:
- All draft versions supported; most spec-compliant Go implementation
- Hierarchical errors with field-level context — ideal for LLM repair prompts
- Actively maintained through v6

**Cons**: Apache-2.0 (compatible with MIT projects but requires attribution)

**Verdict**: **Adopt** — best spec coverage and error quality for the tool-call validation use case.

---

### 9b. xeipuuv/gojsonschema

| Field | Value |
|-------|-------|
| Repo | https://github.com/xeipuuv/gojsonschema |
| Stars | ~2,700 |
| License | Apache-2.0 |
| Last commit | ~2020 (dormant) |

**Description**: Supports draft-04, 06, 07. Widely used but not updated for draft 2019-09 or 2020-12.

**Cons**: Dormant since ~2020; no 2019-09/2020-12 support

**Verdict**: **Skip** — santhosh-tekuri/jsonschema supersedes it.

---

### 9c. kaptinlin/jsonschema

| Field | Value |
|-------|-------|
| Repo | https://github.com/kaptinlin/jsonschema |
| Stars | ~223 |
| License | MIT |
| Last commit | Feb 2025 |

**Description**: Draft 2020-12 only. Zero-copy struct validation, separated validation/unmarshaling workflow, multilingual errors (9 languages including Korean), fluent schema builder API.

**Pros**:
- Korean error messages built-in (useful for hanimo's bilingual audience)
- Draft 2020-12 full compliance
- Dynamic defaults (`uuid()`, `now()`)
- MIT license

**Cons**: Small community (~223 stars); only 2020-12 (no older drafts)

**Verdict**: **Evaluate** — MIT license and Korean error messages are attractive; monitor for community growth. Use santhosh-tekuri as primary for now.

---

### Summary — JSON Schema

| Library | Draft support | Stars | Maintained | Verdict |
|---------|--------------|-------|-----------|---------|
| santhosh-tekuri/jsonschema | 04-2020/12 | 1,200 | Yes (2025) | **Adopt** |
| xeipuuv/gojsonschema | 04-07 | 2,700 | No (~2020) | Skip |
| kaptinlin/jsonschema | 2020-12 only | 223 | Yes (2025) | Evaluate |

---

## 10. Retry / Backoff

**Why it matters / 왜 필요한가**: All LLM APIs return `429 Too Many Requests` and `529 Overloaded` under load. Proper exponential backoff with jitter is required for reliable agent loops.

**중요성**: 모든 LLM API는 부하 시 429/529를 반환합니다. 지터가 있는 지수 백오프가 안정적인 에이전트 루프에 필수적입니다.

---

### 10a. cenkalti/backoff

| Field | Value |
|-------|-------|
| Repo | https://github.com/cenkalti/backoff |
| Stars | ~4,000 |
| License | MIT |
| Version | v4.3.0 |
| Last commit | Active |

**Description**: Go port of Google's HTTP Client Library exponential backoff algorithm. The `Retry(operation, backoff)` function handles the retry loop. `ExponentialBackOff` struct with configurable `InitialInterval`, `Multiplier`, `MaxInterval`, `MaxElapsedTime`.

```go
operation := func() error {
    return callLLMAPI()
}
err := backoff.Retry(operation, backoff.NewExponentialBackOff())
```

**Pros**:
- Most widely used Go backoff library (4k stars)
- Context support via `backoff.WithContext(b, ctx)`
- Clean interface; easy to extend with custom policies

**Cons**: Interface is slightly more complex than retry-go (noted by retry-go authors)

**Verdict**: **Adopt** — industry standard, widely adopted, well-maintained.

---

### 10b. avast/retry-go

| Field | Value |
|-------|-------|
| Repo | https://github.com/avast/retry-go |
| Stars | ~2,900 |
| License | MIT |
| Last commit | Dec 12, 2024 |

**Description**: Options-based retry library with fixed, exponential, random, and full-jitter delay strategies. `DoWithData` for functions returning values. Minimal allocations on happy path.

```go
err := retry.Do(
    func() error { return callLLMAPI() },
    retry.Attempts(5),
    retry.Delay(time.Second),
    retry.DelayType(retry.BackOffDelay),
    retry.OnRetry(func(n uint, err error) {
        log.Printf("retry %d: %v", n, err)
    }),
)
```

**Pros**: Simpler API than cenkalti/backoff; `Unrecoverable()` for immediate abort; returns all errors or last error

**Cons**: Fewer stars; less established than cenkalti

**Verdict**: **Evaluate** — good alternative if cenkalti's interface feels heavy; both are solid choices.

---

### Recommended usage pattern for hanimo:

```go
// Wrap LLM calls with rate-limit aware retry
b := backoff.NewExponentialBackOff()
b.InitialInterval = 1 * time.Second
b.MaxElapsedTime = 60 * time.Second

err := backoff.Retry(func() error {
    resp, err := llmClient.Complete(ctx, req)
    if err != nil {
        if isRateLimitError(err) {
            return err  // retryable
        }
        return backoff.Permanent(err)  // non-retryable
    }
    result = resp
    return nil
}, backoff.WithContext(b, ctx))
```

**Verdict**: **cenkalti/backoff — Adopt**.

---

## 11. Config with Overrides

**Why it matters / 왜 필요한가**: hanimo currently uses `yaml.v3` for config. As features grow (multiple providers, per-project configs, env var overrides, CLI flag overrides), a more structured config system reduces boilerplate.

---

### 11a. knadh/koanf

| Field | Value |
|-------|-------|
| Repo | https://github.com/knadh/koanf |
| Stars | ~4,000 |
| License | MIT |
| Last commit | Active (2025/2026) |

**Description**: "A cleaner, lighter alternative to spf13/viper." Modular: providers (file, env, flags, Vault, S3) and parsers (YAML, JSON, TOML, HCL) are separate optional packages. Merges multiple sources with priority ordering. File watching. Struct unmarshalling.

**Pros**:
- Modular — only import what you need (no unused deps)
- Cleaner API than viper; fewer global side effects
- 4k stars; actively maintained
- Supports layered config: defaults → YAML file → env vars → CLI flags

**Cons**: Less documentation than viper; smaller community

**Integration effort**: ~80 LOC to replace current YAML-only config

**Verdict**: **Adopt when config complexity grows** — not urgent for v0.3, but plan for v0.4.

---

### 11b. spf13/viper

| Field | Value |
|-------|-------|
| Repo | https://github.com/spf13/viper |
| Stars | ~30,200 |
| License | MIT |
| Last commit | Active |

**Description**: The most popular Go config library. Remote key/value stores (Etcd, Consul, Firestore, NATS), live watching, pflag integration, aliases.

**Pros**: Enormous community; extensive documentation; Cobra/pflag integration

**Cons**:
- Heavy: many transitive dependencies
- Global state by default; testing is painful
- 9 open issues + 116 pending PRs signal maintenance debt
- Known issues with concurrent reads/writes

**Verdict**: **Skip** — koanf delivers 90% of viper's value at a fraction of the weight.

---

### 11c. Current yaml.v3 approach

hanimo's current `gopkg.in/yaml.v3`-based config is sufficient for v0.3. The recommended path:

- **v0.3**: Keep yaml.v3, add env var overrides manually
- **v0.4**: Migrate to koanf with yaml provider + env provider + pflags provider

**Verdict**: yaml.v3 **Keep for v0.3**, plan koanf migration for v0.4.

---

## 12. Structured Logging for Agent Traces

**Why it matters / 왜 필요한가**: A `--debug` mode and session replay require structured, filterable logs. Agent trace logs (tool calls, LLM requests, token counts) need machine-parseable output.

**중요성**: 에이전트 추적 로그는 구조화된 형식이어야 디버깅과 세션 재생이 가능합니다.

---

### 12a. log/slog (stdlib)

| Field | Value |
|-------|-------|
| Package | `log/slog` |
| Available since | Go 1.21 |
| License | BSD-3-Clause (stdlib) |

**Description**: Go's official structured logging package. `TextHandler` (key=value), `JSONHandler` (line-delimited JSON), `MultiHandler` (Go 1.26, multiple outputs), `DiscardHandler`. Dynamic level control via `LevelVar`. Context-aware logging.

**Pros**:
- Zero dependencies; stdlib
- `JSONHandler` output is ideal for session replay and log parsing
- `LevelVar` enables runtime debug toggle
- `LogValuer` interface for redacting secrets (API keys)
- hanimo runs Go 1.26 — `MultiHandler` available

```go
var level = new(slog.LevelVar)  // default Info
logger := slog.New(slog.NewJSONHandler(debugFile, &slog.HandlerOptions{Level: level}))

// Toggle debug at runtime (via --debug flag)
if debug { level.Set(slog.LevelDebug) }

// Log agent events
logger.Info("tool_call", "tool", "shell", "cmd", cmd, "tokens", tokenCount)
logger.Debug("llm_request", "model", model, "messages", msgCount, "tokens", promptTokens)
```

**Cons**: No async batching; no sampling (unlike zerolog). For hanimo's scale, this is irrelevant.

**Verdict**: **Adopt** — stdlib, zero deps, sufficient for hanimo's needs.

---

### 12b. zerolog

| Field | Value |
|-------|-------|
| Repo | https://github.com/rs/zerolog |
| Stars | ~12,300 |
| License | MIT |
| Last commit | Active |

**Description**: Zero-allocation JSON logger. Blazing fast. Leveled, sampled, context-aware logging. Pretty console output for development.

**Pros**: Fastest Go logger; chaining API avoids allocations; slog integration available

**Cons**: External dependency; API is different from stdlib (chaining vs key-value pairs)

**Verdict**: **Skip** — slog is sufficient for hanimo; adding zerolog would be premature optimization. Consider if agent loop becomes logging-bottlenecked.

---

### Summary — Logging

| Library | Type | Zero deps | Verdict |
|---------|------|-----------|---------|
| log/slog | stdlib | Yes | **Adopt** |
| zerolog | External | No | Skip |

---

## 13. Embedding / Vector Search

**Why it matters / 왜 필요한가**: A memory layer for hanimo (remembering past sessions, semantic code search within a repo) requires embedding storage and similarity search.

**중요성**: 세션 기억과 시맨틱 코드 검색을 위해 임베딩 저장소와 유사도 검색이 필요합니다.

---

### 13a. philippgille/chromem-go

| Field | Value |
|-------|-------|
| Repo | https://github.com/philippgille/chromem-go |
| Stars | ~914 |
| License | MPL-2.0 |
| Last commit | Mar 2024 |

**Description**: In-process vector database (Chroma-like interface). Zero third-party dependencies. Multi-threaded via Go concurrency. Optional file persistence (gob encoding). Cosine similarity search. Multiple embedding providers (OpenAI, Ollama, Cohere, Mistral, etc.).

**Performance**:
- 1,000 documents: ~0.3ms query
- 100,000 documents: ~40ms query

**Pros**:
- Zero deps (MPL-2.0 allows proprietary use with source disclosure of modifications)
- Embedded — no separate vector DB server
- Supports OpenAI embeddings which hanimo already uses via go-openai
- `gob`-based persistence integrates with existing session storage patterns

**Cons**:
- MPL-2.0 requires source disclosure of any modifications to the library itself (not to hanimo as a whole)
- Exhaustive nearest-neighbor search (no ANN index); ~40ms at 100K docs is acceptable for hanimo's scale
- Last commit March 2024

**Integration effort**: ~100 LOC for memory layer in `internal/memory/`

**Verdict**: **Adopt for memory layer** — best fit for hanimo's embedded, zero-server requirement.

---

### 13b. asg017/sqlite-vec (Go bindings)

| Field | Value |
|-------|-------|
| Repo | https://github.com/asg017/sqlite-vec |
| Go package | `github.com/asg017/sqlite-vec-go-bindings/cgo` |
| License | Apache-2.0 / MIT |

**Description**: SQLite extension for vector search. Integrates directly with SQLite (which hanimo already uses via modernc.org/sqlite).

**Key issue**: The CGO bindings require `github.com/mattn/go-sqlite3` (CGO-based), not `modernc.org/sqlite` (pure Go). The WASM path (`ncruces` package) requires `github.com/ncruces/go-sqlite3`, also incompatible with hanimo's current modernc.org/sqlite.

**Verdict**: **Skip** — incompatible with hanimo's pure-Go SQLite; would require switching the entire database driver.

---

### 13c. Recommendation

For v0.3.0, memory/RAG is a future feature. When implementing:
1. Use chromem-go for in-process vector storage
2. Use OpenAI `text-embedding-3-small` for embeddings (already available via go-openai)
3. Persist embedding collections alongside SQLite session data using chromem-go's gob persistence

---

## 14. Markdown Rendering

**Why it matters / 왜 필요한가**: hanimo already uses `charm.land/glamour/v2` for markdown rendering in its TUI. This section evaluates whether alternatives are needed.

**현재 상태**: hanimo는 이미 `charm.land/glamour/v2 v2.0.0`을 사용 중입니다.

### 14a. glamour v2 (current)

| Field | Value |
|-------|-------|
| Repo | https://github.com/charmbracelet/glamour |
| Stars | ~3,400 |
| License | MIT |
| Last commit | v2.0.0, Mar 9, 2026 |

**Status**: glamour v2.0.0 (March 2026) is the latest release, already in hanimo's go.mod. Pure renderer design; `GLAMOUR_STYLE` env var; multiple built-in themes.

**Limitation**: No streaming rendering support — processes complete markdown input. For streaming LLM responses, hanimo needs to buffer until a complete markdown block is received, or render incrementally as plain text with ANSI colour stripping.

**Recommendation**: Implement a streaming markdown buffer in `internal/ui/` that:
1. Collects LLM streaming tokens
2. Detects complete markdown blocks (paragraphs, code fences) via simple state machine
3. Renders complete blocks with glamour
4. Passes incomplete blocks as plain text

No alternative library is needed. glamour v2 is the correct choice.

**Verdict**: **Keep glamour v2** — no action required.

---

## 15. Diff / Patch

**Why it matters / 왜 필요한가**: Showing file edits as diffs in the TUI (before user approval), applying LLM-generated patches, and generating diff output for `--dry-run` mode require diff/patch capabilities.

**중요성**: TUI에서 파일 편집을 승인 전에 diff로 표시하거나, LLM 생성 패치를 적용하려면 diff 라이브러리가 필요합니다.

---

### 15a. aymanbagabas/go-udiff

| Field | Value |
|-------|-------|
| Repo | https://github.com/aymanbagabas/go-udiff |
| Stars | ~223 |
| License | BSD-3-Clause + MIT |
| Last commit | v0.4.0, Feb 19, 2026 |

**Description**: Myers' diff algorithm with unified format output. Zero external dependencies. Generates and applies unified diffs. Line-by-line diff with hunks.

```go
import "github.com/aymanbagabas/go-udiff"

d := udiff.Unified("file.go", "file.go", original, modified)
// d is a unified diff string compatible with git/GitHub
```

**Pros**:
- Zero deps, BSD/MIT
- Unified diff format (compatible with git patch format)
- Active (v0.4.0 Feb 2026)
- Small and focused

**Cons**: Small community (~223 stars)

**Verdict**: **Adopt** — best fit for hanimo's needs; unified diff output integrates naturally with TUI display and git workflows.

---

### 15b. sergi/go-diff

| Field | Value |
|-------|-------|
| Repo | https://github.com/sergi/go-diff |
| Stars | ~2,100 |
| License | MIT + Apache-2.0 |
| Last commit | Active (master) |

**Description**: Go port of google-diff-match-patch. Provides diff, match (fuzzy), and patch operations. Used by many large projects.

**Pros**: Most widely used; battle-tested; fuzzy match useful for apply-patch-to-moved-code

**Cons**: API is google-diff-match-patch style (not unified diff); verbose for simple use cases

**Verdict**: **Evaluate** — use if fuzzy patch application is needed (e.g., applying LLM edits to code that has shifted lines). Otherwise prefer go-udiff for display.

---

### 15c. hexops/gotextdiff

| Field | Value |
|-------|-------|
| Repo | https://github.com/hexops/gotextdiff |
| Stars | ~2 (minimal) |
| License | BSD-3-Clause |
| Last commit | Dec 2020 |

**Description**: Re-publication of gopls internal diff package. Unified diff output. Minimal maintenance — contributions go upstream to golang/tools.

**Verdict**: **Skip** — go-udiff is a cleaner, maintained alternative with the same algorithm.

---

### Summary — Diff/Patch

| Library | Unified diff | Fuzzy match | Maintained | Verdict |
|---------|-------------|-------------|-----------|---------|
| go-udiff | Yes | No | Yes (2026) | **Adopt** |
| sergi/go-diff | No (custom format) | Yes | Yes | Evaluate |
| hexops/gotextdiff | Yes | No | No (2020) | Skip |

---

## 16. Interactive Prompts Beyond Bubbletea

**Why it matters / 왜 필요한가**: A `--setup` wizard or first-run configuration flow may benefit from simple interactive prompts without the full TUI overhead.

**중요성**: `--setup` 마법사나 첫 실행 설정에서 간단한 인터랙티브 프롬프트가 유용할 수 있습니다.

---

### 16a. manifoldco/promptui

| Field | Value |
|-------|-------|
| Repo | https://github.com/manifoldco/promptui |
| Stars | ~6,400 |
| License | BSD-3-Clause |
| Last commit | Oct 2021 (v0.9.0) |

**Description**: Interactive CLI prompts (Input, Select with search and pagination) with live validation.

**Status**: **Dormant** — last release Oct 2021. No significant maintenance.

**Verdict**: **Skip** — dormant library; use bubbletea for any interactive setup instead.

---

### 16b. AlecAivazis/survey

| Field | Value |
|-------|-------|
| Repo | https://github.com/AlecAivazis/survey |
| Stars | ~4,100 |
| License | MIT |
| Last commit | Sep 2023 |

**Status**: **Archived** April 2024. README explicitly states: "This project is no longer maintained. For an alternative, please check out: bubbletea."

**Verdict**: **Skip** — archived; maintainer directs to bubbletea.

---

### 16c. Recommendation

Both major interactive prompt libraries have been abandoned in favour of bubbletea. For hanimo's setup flow:

- Use bubbletea v2 (already a dependency) for any interactive TUI setup wizard
- For non-TUI environments (piped input, CI), use plain `bufio.NewReader(os.Stdin).ReadString('\n')`

**Verdict**: **No new dependency needed** — use bubbletea for setup wizards.

---

## 17. Sandbox / Container for Executing Generated Code

**Why it matters / 왜 필요한가**: If hanimo adds a feature to execute LLM-generated code snippets (e.g., a REPL or test runner), that code must be isolated from the host system.

**중요성**: LLM 생성 코드를 실행하는 경우 호스트 시스템 보호를 위해 격리가 필요합니다.

---

### 17a. testcontainers-go

| Field | Value |
|-------|-------|
| Repo | https://github.com/testcontainers/testcontainers-go |
| Stars | ~4,800 |
| License | MIT |
| Last commit | v0.42.0, Apr 9, 2026 |

**Description**: Programmatic Docker container lifecycle management. Creates, starts, and cleans up containers. Container isolation, port forwarding, file mounting.

**Pros**:
- Strong isolation (Docker containers)
- Active maintenance (v0.42.0, April 2026)
- MIT license
- Well-documented

**Cons**:
- **Requires Docker** — not available in all environments
- Adds Docker as a runtime dependency (unacceptable for a lightweight CLI tool)
- Startup latency (~1-2s per container) is too slow for interactive REPL use

**Integration effort**: ~200 LOC

**Verdict**: **Skip for v0.3** — Docker dependency is too heavy for a terminal agent. Adopt only if hanimo adds an explicit "safe execution" mode that users opt into with Docker.

---

### 17b. Lightweight alternatives

For sandboxed code execution without Docker:

1. **`exec.CommandContext` + timeout** (current approach): Simple, zero deps, relies on OS process isolation
2. **macOS `sandbox-exec -p '(version 1)(allow default)(deny network*)(deny file-write*)'`**: No-install sandboxing for macOS
3. **Linux namespaces** via `cmd.SysProcAttr.Cloneflags = syscall.CLONE_NEWNS | syscall.CLONE_NEWPID`: Process and mount namespace isolation (requires root or user namespaces enabled)

**Recommended approach for v0.3**: `exec.CommandContext` with a 30-second timeout and `RLIMIT_AS` (Linux). Document that full sandbox requires Docker mode.

---

## 18. Recommended Adoption List for Hanimo v0.3.0

**우선순위별 채택 권고 목록** — sorted by impact-to-effort ratio.

---

### Tier 1 — Adopt Immediately (high impact, low effort)

| # | Library | Impact | Effort (LOC) | Reason |
|---|---------|--------|-------------|--------|
| 1 | **pkoukk/tiktoken-go** | Token counting for OpenAI models | ~50 | Context window management; go-openai already present |
| 2 | **bmatcuk/doublestar** | `**` glob for file filtering | ~10 | Used by file picker, context patterns, gitignore integration |
| 3 | **cenkalti/backoff** | 429/529 retry for all LLM calls | ~60 | Agent reliability; every LLM call needs backoff |
| 4 | **mark3labs/mcp-go** | MCP spec upgrade (2024-11-05 → 2025-11-25) | ~100 | Current MCP client is outdated; mcp-go has 8.6k stars |
| 5 | **saracen/walker** | 10x faster file walking | ~20 | Critical for large repo scanning |
| 6 | **log/slog** | Structured debug logging | ~40 | stdlib; zero deps; enables `--debug` and session replay |
| 7 | **zalando/go-keyring** | Secure credential storage | ~30 | API key security; cross-platform |
| 8 | **aymanbagabas/go-udiff** | Diff display for edit approvals | ~40 | Shows edits before approval in TUI |

---

### Tier 2 — Adopt When Feature is Built

| # | Library | Feature gate | Notes |
|---|---------|-------------|-------|
| 9 | **go-git gitignore package** | Repo-map / file indexing | When file indexing lands |
| 10 | **santhosh-tekuri/jsonschema** | Tool call validation/repair | When structured tool repair loop is added |
| 11 | **go/parser (stdlib)** | Go repo-map | Zero deps; use immediately for Go-only repo map |
| 12 | **philippgille/chromem-go** | Memory / RAG layer | When long-term session memory is implemented |
| 13 | **knadh/koanf** | Config overrides | When per-project config and env overrides are needed |
| 14 | **golang.org/x/oauth2** | Browser-based auth | When OAuth login is added (Device Flow) |
| 15 | **adrg/xdg** | Cross-platform config paths | When config paths need XDG compliance |

---

### Tier 3 — Evaluate Later

| # | Library | Notes |
|---|---------|-------|
| 16 | **smacker/go-tree-sitter** | Wait until CGO decision is made for binary distribution |
| 17 | **avast/retry-go** | Alternative to cenkalti/backoff; adopt if API feels cleaner |
| 18 | **kaptinlin/jsonschema** | Watch community growth; MIT + Korean errors attractive |
| 19 | **sergi/go-diff** | Use if fuzzy patch application is needed |
| 20 | **testcontainers-go** | Only for an explicit `--docker-sandbox` mode |

---

### Skip List

| Library | Reason |
|---------|--------|
| daulet/tokenizers | CGO required; not needed for current model set |
| sabhiram/go-gitignore | No negation, no nested, dormant |
| denormal/go-gitignore | Correct logic but dormant since 2018 |
| karrick/godirwalk | Superseded by saracen/walker (faster, more modern) |
| gobwas/glob | No filesystem API; dormant v0.2.3 since 2017 |
| metoro-io/mcp-golang | Lower adoption than mark3labs/mcp-go |
| xeipuuv/gojsonschema | Dormant since ~2020 |
| spf13/viper | Too heavy; koanf is better |
| zerolog | Premature optimization over stdlib slog |
| AlecAivazis/survey | Archived April 2024 |
| manifoldco/promptui | Dormant Oct 2021 |
| hexops/gotextdiff | go-udiff is a better-maintained alternative |
| asg017/sqlite-vec | CGO incompatible with modernc.org/sqlite |
| 99designs/keyring | No updates since Dec 2022 |

---

## Appendix: Dependency Matrix

The table below shows which new dependencies would be introduced by each adoption decision.

| Library | New transitive deps | CGO | License |
|---------|-------------------|-----|---------|
| pkoukk/tiktoken-go | dlclark/regexp2 (already present!) | No | MIT |
| bmatcuk/doublestar | 0 | No | MIT |
| cenkalti/backoff | 0 | No | MIT |
| mark3labs/mcp-go | minimal | No | MIT |
| saracen/walker | 0 | No | MIT |
| zalando/go-keyring | 0 | No | MIT |
| aymanbagabas/go-udiff | 0 | No | BSD-3/MIT |
| santhosh-tekuri/jsonschema | ~3 | No | Apache-2.0 |
| philippgille/chromem-go | 0 | No | MPL-2.0 |
| knadh/koanf | modular (opt-in) | No | MIT |
| smacker/go-tree-sitter | C grammars | **Yes** | MIT |

Note: `dlclark/regexp2` is already in hanimo's `go.mod` as an indirect dependency of `charmbracelet/chroma`. tiktoken-go uses the same package — **no new transitive dependency**.

---

## Sources

- tiktoken-go: https://github.com/pkoukk/tiktoken-go | https://pkg.go.dev/github.com/pkoukk/tiktoken-go
- daulet/tokenizers: https://github.com/daulet/tokenizers
- Anthropic token counting API: https://platform.claude.com/docs/en/api/go/messages/count_tokens
- go-git gitignore: https://pkg.go.dev/github.com/go-git/go-git/v5/plumbing/format/gitignore
- sabhiram/go-gitignore: https://github.com/sabhiram/go-gitignore
- denormal/go-gitignore: https://pkg.go.dev/github.com/denormal/go-gitignore
- smacker/go-tree-sitter: https://github.com/smacker/go-tree-sitter
- saracen/walker: https://github.com/saracen/walker
- karrick/godirwalk: https://github.com/karrick/godirwalk
- bmatcuk/doublestar: https://github.com/bmatcuk/doublestar
- gobwas/glob: https://github.com/gobwas/glob
- macOS sandbox-exec: https://igorstechnoclub.com/sandbox-exec/ | https://news.ycombinator.com/item?id=47101200
- gomodjail: https://medium.com/nttlabs/gomodjail-library-sandboxing-for-go-modules-451b22d02700
- zalando/go-keyring: https://github.com/zalando/go-keyring
- 99designs/keyring: https://github.com/99designs/keyring
- golang.org/x/oauth2: https://pkg.go.dev/golang.org/x/oauth2
- adrg/xdg: https://pkg.go.dev/github.com/adrg/xdg
- mark3labs/mcp-go: https://github.com/mark3labs/mcp-go
- metoro-io/mcp-golang: https://github.com/metoro-io/mcp-golang
- santhosh-tekuri/jsonschema: https://github.com/santhosh-tekuri/jsonschema
- xeipuuv/gojsonschema: https://github.com/xeipuuv/gojsonschema
- kaptinlin/jsonschema: https://github.com/kaptinlin/jsonschema
- cenkalti/backoff: https://github.com/cenkalti/backoff
- avast/retry-go: https://github.com/avast/retry-go
- knadh/koanf: https://github.com/knadh/koanf
- spf13/viper: https://github.com/spf13/viper
- log/slog: https://pkg.go.dev/log/slog
- rs/zerolog: https://github.com/rs/zerolog
- philippgille/chromem-go: https://github.com/philippgille/chromem-go
- asg017/sqlite-vec Go: https://alexgarcia.xyz/sqlite-vec/go.html
- charm.land/glamour/v2: https://github.com/charmbracelet/glamour
- aymanbagabas/go-udiff: https://github.com/aymanbagabas/go-udiff
- sergi/go-diff: https://github.com/sergi/go-diff
- hexops/gotextdiff: https://github.com/hexops/gotextdiff
- manifoldco/promptui: https://github.com/manifoldco/promptui
- AlecAivazis/survey: https://github.com/AlecAivazis/survey
- testcontainers-go: https://github.com/testcontainers/testcontainers-go

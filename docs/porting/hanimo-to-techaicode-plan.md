# hanimo → TECHAI_CODE Porting Plan

> Reverse-porting guide for moving hanimo features into TECHAI_CODE (Shinhan
> Bank closed-network fork). Written so a fresh agent can execute each step
> without re-analyzing either codebase.

---

## 1. Introduction

### 1.1 Purpose
This document is a **preparation artifact** for a future porting session. It
enumerates every hanimo feature that is a candidate for backporting into
TECHAI_CODE, prescribes an execution order, and records all the tribal
knowledge (module paths, package layouts, closed-network constraints) needed
to do the work mechanically.

### 1.2 Context: why bidirectional porting
- **hanimo** (`github.com/flykimjiwon/hanimo`) — public open-source Go/Bubble
  Tea AI coding agent. Fast-moving, multi-provider, cloud-friendly.
- **TECHAI_CODE / TGC** (`github.com/kimjiwon/tgc`) — closed-network fork for
  Shinhan Bank. Single internal API gateway, Korean-only branding, no external
  network.
- Both share a common ancestor and diverge in opposite directions: hanimo
  gains features, TGC gains hardening + compliance. Features proven in hanimo
  should flow back into TGC once they are reviewed for closed-network safety.

### 1.3 Scope
- **In scope:** features that exist in `hanimo/internal/**` but are missing
  or less capable in `TECHAI_CODE/internal/**`, as of the snapshot analyzed
  while writing this document.
- **Out of scope:** architectural rewrites, dependency upgrades, anything
  that touches the Shinhan internal API gateway contract, CI/CD, or packaging
  (`Makefile`, `dist/`).

### 1.4 Snapshot of both codebases (reference)

```
hanimo/internal/                   TECHAI_CODE/internal/
├── agents/auto.go                 ├── app/app.go
├── app/app.go                     ├── config/
├── config/                        ├── gitinfo/
├── knowledge/                     ├── knowledge/
├── llm/                           ├── llm/
│   └── providers/                 │   ├── capabilities.go
│       ├── anthropic.go           │   ├── client.go
│       ├── google.go              │   ├── compaction.go
│       ├── ollama.go              │   ├── context.go
│       ├── openai_compat.go       │   ├── models.go
│       └── registry.go            │   └── prompt.go
├── mcp/                           ├── session/
│   ├── client.go                  │   └── store.go           (no db.go, no memory.go)
│   ├── transport_sse.go           ├── tools/
│   └── transport_stdio.go         │   ├── file.go
├── session/                       │   ├── registry.go
│   ├── db.go                      │   ├── search.go
│   ├── memory.go                  │   └── shell.go           (no git/diagnostics/hashline)
│   ├── store.go                   └── ui/
│   └── usage.go                       ├── chat.go
├── tools/                             ├── context.go
│   ├── diagnostics.go                 ├── dev.go
│   ├── file.go                        ├── plan.go
│   ├── git.go                         ├── styles.go
│   ├── hashline.go                    ├── super.go
│   ├── registry.go                    └── tabbar.go
│   ├── search.go                      (no palette.go, menu.go, i18n.go)
│   └── shell.go
└── ui/
    ├── chat.go
    ├── dev.go
    ├── i18n.go
    ├── menu.go
    ├── palette.go
    ├── plan.go
    ├── styles.go
    ├── super.go
    └── tabbar.go
```

Module paths (critical for every `import` rewrite):
- hanimo:        `github.com/flykimjiwon/hanimo`
- TECHAI_CODE:   `github.com/kimjiwon/tgc`

---

## 2. Feature Matrix

| # | Feature | hanimo source | Decision | Complexity | Priority |
|---|---------|---------------|----------|------------|----------|
| 1 | Hash-anchored editing (`hashline_read`/`hashline_edit`) | `internal/tools/hashline.go` | **PORT** | Easy | High |
| 2 | Git tools (`git_status`/`git_diff`/`git_log`/`git_commit`) | `internal/tools/git.go` | **PORT** | Easy | Medium |
| 3 | Diagnostics tool (go vet/tsc/eslint/ruff) | `internal/tools/diagnostics.go` | **PORT** | Easy | Medium |
| 4 | Memory system (`/remember`, `/memories`) | `internal/session/memory.go` | **PORT** (needs schema) | Medium | Medium |
| 5 | Auto mode (`/auto`, 20-iteration loop) | `internal/agents/auto.go` + `internal/app/app.go` | **PORT** | Medium | High |
| 6 | MCP client (JSON-RPC 2.0, stdio + SSE) | `internal/mcp/{client,transport_stdio,transport_sse}.go` | **PORT** (stdio only initially) | Hard | High |
| 7 | Command palette (Ctrl+K) | `internal/ui/palette.go` | **PORT** | Medium | Low |
| 8 | Interactive menu (Esc) | `internal/ui/menu.go` + `app.go` updateMenu/openMenu | **PORT** (model/provider switcher stripped) | Medium | Low |
| 9 | Theme system (5 themes, `/theme`) | `internal/ui/styles.go` `Themes` map | **SKIP** | — | — |
| 10 | I18N KR/EN (`/lang`) | `internal/ui/i18n.go` | **SKIP** | — | — |
| 11 | Multi-provider registry (Anthropic/Google/Ollama/OpenAI-compat) | `internal/llm/providers/*` | **SKIP** | — | — |

Rationale for the three **SKIP** entries is in §6.

---

## 3. Per-Feature Porting Briefs

Each brief is self-contained. If you only need to port one feature, read its
brief plus §5 (step-by-step) and you are done.

### 3.1 Hash-anchored editing (hashline)

- **What it does.** Every line of a file is paired with its MD5 hash. Edits
  must present the hash of the line they are replacing; if the file shifted
  underneath the agent the edit is rejected before corruption happens.
- **Source files (hanimo).**
  - `internal/tools/hashline.go` (116 lines) — defines `hashline_read` and
    `hashline_edit`.
  - Registered inside `internal/tools/registry.go`.
- **Target files (TECHAI_CODE).**
  - New: `internal/tools/hashline.go`
  - Modify: `internal/tools/registry.go` (add the two tool registrations)
- **Dependencies.** `crypto/md5`, `encoding/hex`, `os`, `strings`. All stdlib.
  No new go.mod entries.
- **Module-path rewrites.** Change package-level imports from
  `github.com/flykimjiwon/hanimo/internal/...` to
  `github.com/kimjiwon/tgc/internal/...` (usually just `tools` and `session`
  helpers).
- **Risks / caveats.**
  - TGC `tools/file.go` may already have an `Edit` tool that overlaps. Keep
    both — hashline is the **safe** variant; the agent prompt should prefer it
    for multi-line edits. Do not delete TGC's existing editor.
  - Watch for CRLF: hanimo normalizes on `\n`; confirm TGC test fixtures use
    the same convention.
- **Complexity.** Easy. Isolated file, no UI changes.

### 3.2 Git tools

- **What it does.** Exposes `git_status`, `git_diff`, `git_log`, `git_commit`
  as agent-callable tools by shelling out to `git` with controlled arguments.
- **Source.** `internal/tools/git.go` (52 lines).
- **Target.** New `internal/tools/git.go`; register in
  `internal/tools/registry.go`.
- **Dependencies.** `os/exec`. TGC already has `internal/gitinfo/` which
  wraps some git calls — check whether to reuse its helpers vs. shelling out
  directly. Recommendation: shell out directly to keep the port mechanical,
  then refactor later.
- **Risks.**
  - `git_commit` accepts a commit message from the LLM. In the closed-network
    environment a committed message could leak context into audit logs —
    confirm with compliance before enabling write operations. **Default the
    port to read-only (`status`/`diff`/`log`) and gate `git_commit` behind a
    config flag.**
- **Complexity.** Easy.

### 3.3 Diagnostics tool

- **What it does.** Auto-detects `go vet`, `tsc`, `eslint`, `ruff` based on
  project manifest files and returns normalized diagnostics.
- **Source.** `internal/tools/diagnostics.go` (272 lines). Largest of the
  "easy" tool ports.
- **Target.** New `internal/tools/diagnostics.go`; register in
  `internal/tools/registry.go`.
- **Dependencies.** `os/exec`, `encoding/json`. All binaries must already be
  on `PATH` — this is a runtime dependency, not a build one. Inside Shinhan's
  closed network confirm which of the four linters are actually installed on
  developer machines; guard missing ones with a graceful "not installed"
  response (hanimo already does this).
- **Risks.** None beyond missing binaries.
- **Complexity.** Easy.

### 3.4 Memory system (`/remember`, `/memories`)

- **What it does.** Persists long-term agent memories keyed by session/user
  in SQLite. Slash commands `/remember <text>` and `/memories` manage them.
- **Source.**
  - `internal/session/memory.go` (87 lines) — CRUD helpers.
  - `internal/session/db.go` — opens SQLite, owns schema creation. **TGC does
    not have `db.go`; it has `store.go` instead.** You must decide whether to:
    1. Copy hanimo's `db.go` alongside TGC's existing `store.go`, or
    2. Fold the `memories` table creation into TGC's `store.go` and only
       copy `memory.go`. **Recommended.**
- **Target.**
  - New: `internal/session/memory.go`
  - Modify: `internal/session/store.go` — add schema bootstrap for
    `memories(id INTEGER PRIMARY KEY, session_id TEXT, content TEXT, created_at INTEGER)`.
  - Modify: `internal/app/app.go` — add `/remember` and `/memories` cases in
    `handleSlashCommand`.
- **Dependencies.** Whatever SQLite driver TGC already uses (likely
  `modernc.org/sqlite` — verify against `go.mod`). No new driver.
- **Risks.**
  - Schema migration: if TGC ships with versioned migrations, add the table
    as a new migration step rather than patching the create statement.
  - Data residency: memories live on the local user machine — no compliance
    impact, but note it in the commit message.
- **Complexity.** Medium (schema surgery).

### 3.5 Auto mode (`/auto`)

- **What it does.** Kicks off an autonomous loop: the agent keeps calling
  itself (with tool access) until the task is marked done or 20 iterations
  elapse. Prevents runaway loops with a hard cap and per-iteration budget.
- **Source.**
  - `internal/agents/auto.go` (26 lines — mostly orchestration scaffolding;
    real work lives in the main agent loop that it calls into).
  - `internal/app/app.go` — `handleSlashCommand` branch for `/auto`.
- **Target.**
  - New package: `internal/agents/` with `auto.go`. TGC currently has no
    `agents/` directory — create it.
  - Modify: `internal/app/app.go` — new `/auto <prompt>` branch and any
    related UI state.
- **Dependencies.** Reuses existing LLM client + tool registry. No new
  external libs. The `20` iteration cap should be exposed as a
  `config` value rather than hard-coded, so TGC operators can lower it.
- **Risks.**
  - Auto mode is the feature most likely to burn tokens unexpectedly. TGC
    runs against an internal API gateway with quotas — surface the iteration
    count and cumulative token spend in the UI before enabling.
  - Error handling: if a tool errors mid-loop, hanimo continues. TGC should
    probably halt on repeated identical errors (add a simple dedupe).
- **Complexity.** Medium. Only 26 lines of orchestration but deeply
  integrated with the agent loop.

### 3.6 MCP client

- **What it does.** Speaks JSON-RPC 2.0 to Model Context Protocol servers
  over stdio (spawned subprocess) or SSE (HTTP long-poll). Lets the agent
  call external tools/resources defined by MCP servers.
- **Source.**
  - `internal/mcp/client.go` (204 lines) — request/response plumbing.
  - `internal/mcp/transport_stdio.go` (101 lines) — subprocess transport.
  - `internal/mcp/transport_sse.go` (29 lines) — HTTP transport.
- **Target.** New package `internal/mcp/` with all three files.
- **Dependencies.** `encoding/json`, `os/exec`, `bufio`, `net/http` — all
  stdlib. No `github.com/modelcontextprotocol/*` SDK needed.
- **Risks.**
  - **SSE transport must NOT ship** in the first pass: SSE is an outbound
    HTTP call which violates closed-network assumptions. Port stdio only;
    leave `transport_sse.go` out until the network review clears it.
  - MCP servers are subprocesses — each one is an arbitrary binary the user
    can launch. For Shinhan Bank, restrict to an explicit allowlist loaded
    from config, not free-form from the LLM.
- **Complexity.** Hard. New subsystem, biggest single porting task by LOC.

### 3.7 Command palette (Ctrl+K)

- **Source.** `internal/ui/palette.go` (154 lines). Fuzzy-search overlay.
- **Target.** New `internal/ui/palette.go`; hook into `internal/app/app.go`
  `Update` loop for Ctrl+K keybind and result dispatching.
- **Dependencies.** TGC already uses Bubble Tea — no new libs. Fuzzy matcher
  is hand-rolled in hanimo; copy verbatim.
- **Risks.** Keybinding collisions with TGC's existing shortcuts — audit
  `app.go` `Update` before wiring Ctrl+K.
- **Complexity.** Medium.

### 3.8 Interactive menu (Esc)

- **Source.** `internal/ui/menu.go` (98 lines) + `updateMenu`/`openMenu` in
  `internal/app/app.go`.
- **Target.** New `internal/ui/menu.go`; new handlers in TGC `app.go`.
- **Strip before porting.** hanimo's menu switches model **and** provider.
  TGC has a single provider, so remove the provider sub-menu and keep only
  model selection (if multiple models are exposed by the gateway).
- **Risks.** Same as palette — keybind audit.
- **Complexity.** Medium.

---

## 4. Recommended Porting Order

Chosen so that each step is (a) independently testable and (b) touches files
that no later step will clobber. Stop-and-verify between every step.

1. **Hash-anchored editing** — fully isolated new file; lowest blast radius.
2. **Git tools (read-only first)** — isolated; gives the agent a safe new
   capability.
3. **Diagnostics tool** — isolated; largest of the trio but still single-file.
4. **Memory system** — first schema change; requires DB migration thinking.
5. **Auto mode** — first change to the main agent loop; depends on nothing
   above but benefits from the new tools being available.
6. **MCP client (stdio only)** — new subsystem; completely additive.
7. **Command palette** — first UI intrusion; tests keybind discipline.
8. **Interactive menu** — second UI intrusion; reuses palette discipline.

Skip steps 9–11 (see §6).

---

## 5. Per-Feature Step-by-Step

Conventions used below:
- Paths starting with `hanimo/` are source; `tgc/` are target.
- "Rewrite imports" means: `sed`-style replace of
  `github.com/flykimjiwon/hanimo` → `github.com/kimjiwon/tgc` inside the
  copied file. Do this in the editor — never run a global sed across the
  repo.

### 5.1 Hashline

1. Copy `hanimo/internal/tools/hashline.go` → `tgc/internal/tools/hashline.go`.
2. Rewrite imports in the new file.
3. Open `tgc/internal/tools/registry.go`. Find where `file.go` tools are
   registered. Register `hashline_read` and `hashline_edit` in the same
   function following the existing pattern.
4. Build: `cd TECHAI_CODE && go build ./...`.
5. Manual test: launch TGC, ask the agent to `hashline_read` a file, verify
   the hash column is present; then `hashline_edit` a line and confirm a
   stale-hash edit is rejected.

### 5.2 Git tools

1. Copy `hanimo/internal/tools/git.go` → `tgc/internal/tools/git.go`.
2. Rewrite imports.
3. **Gate `git_commit`.** Wrap the `git_commit` registration behind a
   `config.EnableGitWrite` boolean (add the field to TGC's config struct,
   default `false`).
4. Register the read tools unconditionally in `registry.go`.
5. Build + manual test `git_status`, `git_diff`, `git_log` in a dirty repo.

### 5.3 Diagnostics

1. Copy `hanimo/internal/tools/diagnostics.go` → same path in TGC.
2. Rewrite imports.
3. Register in `registry.go` as `diagnostics`.
4. Build + run inside a repo containing at least one of: `go.mod`,
   `package.json` (with tsc or eslint), `pyproject.toml` (with ruff).
5. Confirm each missing linter returns a friendly "not installed" result
   rather than a process error.

### 5.4 Memory system

1. Inspect `tgc/internal/session/store.go`. Identify the schema bootstrap
   (usually a `CREATE TABLE IF NOT EXISTS` block near `Open`).
2. Add the `memories` table:
   ```sql
   CREATE TABLE IF NOT EXISTS memories (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       session_id TEXT NOT NULL,
       content TEXT NOT NULL,
       created_at INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS memories_session_idx ON memories(session_id);
   ```
3. Copy `hanimo/internal/session/memory.go` → `tgc/internal/session/memory.go`.
   Adapt it to use TGC's `store.DB` handle (hanimo exposes `db.DB`; rename
   the accessor if needed).
4. Rewrite imports.
5. Open `tgc/internal/app/app.go`. In `handleSlashCommand` add branches for
   `/remember` (append) and `/memories` (list, most-recent-first).
6. Build + manual test: `/remember foo`, then `/memories`, then restart the
   TUI and confirm `foo` persists.

### 5.5 Auto mode

1. Create directory `tgc/internal/agents/`.
2. Copy `hanimo/internal/agents/auto.go` → `tgc/internal/agents/auto.go`.
3. Rewrite imports. Replace any reference to hanimo-only helpers (e.g. a
   `providers` registry) with direct calls to `tgc/internal/llm` client.
4. Expose iteration cap via config: add `AutoMaxIterations int` to TGC's
   config struct, default `20`.
5. In `tgc/internal/app/app.go` `handleSlashCommand`, add a `/auto` case that
   invokes `agents.RunAuto(ctx, prompt, cfg.AutoMaxIterations)`.
6. Add UI affordance: show `[auto 3/20]` in the status line while looping.
7. Build. Manual test with a trivial task ("list all .go files, then count
   lines in the largest one"). Confirm it terminates and reports iteration
   count.

### 5.6 MCP client (stdio only)

1. Create directory `tgc/internal/mcp/`.
2. Copy `client.go` and `transport_stdio.go` only. **Do not copy
   `transport_sse.go` yet.**
3. Rewrite imports. Remove any reference to SSE transport from `client.go`
   if it is wired via an interface registry — leave the interface, drop the
   registration.
4. Add config: `MCPServers []MCPServerConfig` where each entry has
   `{Name, Command, Args, Env}`. **Require an allowlist — no dynamic server
   spawn.**
5. On TGC startup, iterate allowlisted servers, connect, and merge their
   advertised tools into the tool registry under a `mcp:<server>/<tool>`
   prefix.
6. Build + manual test with a trivial stdio MCP server (e.g. a Go
   `echo-mcp` you write in 30 lines). Verify `tools/list` returns the
   echo tool and the agent can call it.

### 5.7 Command palette

1. Copy `hanimo/internal/ui/palette.go` → `tgc/internal/ui/palette.go`.
2. Rewrite imports.
3. In `tgc/internal/app/app.go` `Update`, detect `tea.KeyMsg` with
   `Ctrl+K`. Audit existing keybinds first to avoid collision.
4. Render the palette as an overlay above the chat view (hanimo pattern).
5. Build. Manual test: Ctrl+K opens, type to fuzzy-filter, Enter dispatches.

### 5.8 Interactive menu

1. Copy `hanimo/internal/ui/menu.go` → `tgc/internal/ui/menu.go`.
2. Rewrite imports.
3. **Strip provider selection.** Remove any code that lists providers; keep
   only model selection (and even that is optional — skip if TGC only
   exposes one model).
4. Port `updateMenu` / `openMenu` from hanimo `app.go` into TGC `app.go`.
   Hook Esc to `openMenu`.
5. Build + manual test Esc flow.

---

## 6. Things to NOT Port (and why)

| Feature | Reason |
|---|---|
| Multi-provider registry (`internal/llm/providers/*`) | TGC talks only to Shinhan's internal API gateway. The gateway is already wired through `internal/llm/client.go`. Adding a registry introduces a config surface that could be misused to point at external URLs. |
| Anthropic provider | Cloud-only, outbound network. Closed-network violation. |
| Google provider | Same. |
| Ollama provider | Spawns a local server and pulls models from the internet. Not compliant. |
| `/theme` slash command + `Themes` map | TGC has a fixed brand palette tied to the "택가이코드" identity. Multiple themes dilute branding. |
| `/lang` + `i18n.go` | TGC is Korean-only by product decision. The English strings would become stale and accidentally ship. |
| Any `README.md` / `LICENSE` references to GitHub.com/flykimjiwon/hanimo | The closed-network build must never resolve external URLs. Audit after every port. |
| `hanimo/_legacy_ts` | Dead TypeScript legacy code. |

---

## 7. Post-Port Verification

Run this checklist after each feature lands — do **not** batch them.

### 7.1 Per-feature checks

| Feature | Command / action | Expected |
|---|---|---|
| hashline | `go build ./...`; call `hashline_read` on `go.mod`; mutate the file externally; retry `hashline_edit` with an old hash | Second edit is rejected with a clear "hash mismatch" error |
| git tools | In a dirty repo, run `/tool git_status`, `/tool git_diff`, `/tool git_log` | Match `git` CLI output shape |
| diagnostics | In a repo with `go.mod` containing a vet warning | `diagnostics` tool returns the warning; missing linters reported gracefully |
| memory | `/remember hello`; restart TUI; `/memories` | Entry persists |
| auto | `/auto list all .md files then stop` | Terminates in ≤20 iters, status line shows iteration count |
| MCP (stdio) | Launch with an allowlisted echo-mcp server | Echo tool appears in tool list and is callable |
| palette | Ctrl+K → type → Enter | Overlay appears, fuzzy filter works, action dispatches |
| menu | Esc | Menu opens; model selection works; provider sub-menu absent |

### 7.2 Global checks after every port

- `go build ./...` clean.
- `go vet ./...` clean.
- `go test ./...` — all existing TGC tests still pass.
- `grep -R "flykimjiwon" tgc/` returns **zero** matches. (This is the most
  common porting mistake.)
- `grep -R "github.com/flykimjiwon" tgc/go.sum` returns zero matches.
- No new outbound URLs: `grep -RE "https?://[^\"']+" tgc/internal/` diff
  should not add any public domain.

---

## 8. Future Considerations

### 8.1 Keeping hanimo and TGC in sync
- **Short term (now).** Maintain this document. Every merge into hanimo
  `main` that touches a file listed in §2 should trigger a "port candidate"
  note in TGC's own issue tracker.
- **Medium term.** Adopt a labeled commit convention in hanimo
  (`port-candidate: yes` trailer) so that a simple `git log` scan produces
  the TGC backport queue.
- **Long term.** Extract a `hanimo-core` Go module containing:
  - `internal/tools/*` (except provider-specific ones)
  - `internal/mcp/*`
  - `internal/session/*` data layer
  - `internal/agents/*`
  and import it from both projects. TGC would pin a commit hash from a
  mirrored internal Git server. The fork point would narrow from "whole
  repo" to "UI shell + config + branding" — maybe 10% of the current
  surface area.

### 8.2 Shared-core caveats
- The shared module must avoid `init()`-time network calls and must not
  embed anything resembling telemetry. A compile-time build tag
  `noexternal` is the cleanest enforcement mechanism.
- Provider plugins must remain on the **hanimo** side of the split, not
  in the shared core, so TGC never accidentally pulls them in.

### 8.3 Go-specific notes to remember
- `embed.FS` paths are relative to the package directory — if a file moves
  between packages during a port, the `//go:embed` directive must be
  updated.
- Import aliases (`tui "github.com/charmbracelet/bubbletea"`) may differ
  between projects. Do not blindly copy import blocks; adapt to TGC's
  existing conventions.
- `go.sum` updates must be committed together with the `go.mod` edit — a
  port that forgets this will break reproducible builds inside the closed
  network.
- Closed-network builds should be run with `GOFLAGS=-mod=vendor` and a
  populated `vendor/` tree. Every port must end with `go mod vendor`
  before commit.

---

*End of plan. When executing, check off each item in §5 in the actual
commit message and use the commit-trailer convention documented in the
project CLAUDE.md.*

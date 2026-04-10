# Hanimo Certified Model System — Implementation Plan

**Status:** Draft v1
**Target release:** v0.3.0
**Author:** planner agent (overnight session)
**Scope:** Replace `internal/llm/capabilities.go` hardcoded map with a tiered, profile-driven Certified Model System.
**역할:** 본 문서는 내일 executor 에이전트가 실제 코드로 구현할 수 있도록 작성된 실행형 계획서입니다.

---

## 0. TL;DR (한글 요약)

Hanimo 는 지금까지 "모든 OpenAI-compatible 모델이 동작한다"는 무한 호환성(infinite compatibility) 전략을 취해 왔습니다. 현실은 — 어떤 모델에서도 "완벽히" 동작하지 않습니다. 툴 포맷, 시스템 프롬프트 반응, 컨텍스트 윈도, JSON 신뢰도가 모델마다 제각각이기 때문입니다.

**새 전략: Certified Model System (인증 모델 체계).**

- **Tier 1 — Certified (8~10개):** 매 릴리스마다 직접 손으로 튜닝·테스트하여 "작동 보장"을 마케팅할 수 있는 모델.
- **Tier 2 — Supported:** 프로필은 있으나 자동 테스트까지는 보장하지 않는 모델. 동작은 하지만 사용자 리스크.
- **Tier 3 — Experimental:** 프로필만 제공, best-effort.
- **Tier Unknown — Generic fallback:** 프로필 없는 모델은 안전한 generic 프로필 + 경고 배너로 처리.

핵심 산출물:

1. `ModelProfile` 구조체 + YAML 임베드 카탈로그
2. 모델별 프롬프트 템플릿 선택기
3. 토큰 기반 컨텍스트 버짓 관리 (현 `len(messages)<40` 가드 교체)
4. `hanimo --list-models` CLI
5. `make test-certified` 시나리오 매트릭스
6. 18개 기존 모델을 하위호환 유지하며 새 시스템으로 이관

---

## 1. Data Model — `ModelProfile`

### 1.1 Design goals

| Goal | Why |
|---|---|
| 모든 모델 차별화 요소를 한 구조체에 | 런타임 분기 로직(이 모델이면 JSON 강제, 저 모델이면 짧은 프롬프트)을 한 곳에서 조회 |
| YAML 로 편집 가능하되 컴파일 타임 검증 | 오타/누락 필드를 CI 에서 잡음 |
| 버전 필드 포함 | 카탈로그 릴리스 노트 생성 자동화 |
| 프로필 = 모델의 "성격서" | prompt.go 의 `SystemPrompt(mode)` 가 프로필을 받아 텍스트를 특화 |

### 1.2 Struct definition

새 파일: `internal/llm/profile.go`

```go
package llm

import "time"

// Tier is the certification level of a model.
type Tier int

const (
    TierCertified    Tier = iota // 1 — hand-tuned + tested every release
    TierSupported                 // 2 — profile maintained, no auto test
    TierExperimental              // 3 — best-effort profile
    TierUnknown                   // 0/fallback — generic profile used
)

// ToolFormat describes how a model emits tool calls.
type ToolFormat int

const (
    ToolFormatOpenAIJSON  ToolFormat = iota // Native OpenAI tool_calls
    ToolFormatAnthropic                       // Anthropic tool_use blocks
    ToolFormatGemini                          // Gemini functionCall
    ToolFormatReActText                       // "Action: foo\nAction Input: {...}"
    ToolFormatXMLTags                         // <tool_call>...</tool_call>
    ToolFormatNone                            // No tools — chat only
)

// PromptStyle is the preferred system-prompt variant for a model.
type PromptStyle int

const (
    PromptStyleFull    PromptStyle = iota // Long directive prompts (Claude/GPT-4)
    PromptStyleShort                      // Aggressively trimmed prompts (small local models)
    PromptStyleReAct                      // ReAct scaffold for models without native tool calls
    PromptStyleMinimal                    // Only the bare task, no tool catalog
)

// ModelProfile describes everything Hanimo needs to know about a model.
type ModelProfile struct {
    // ---- Identity ----
    ID          string   `yaml:"id"`                    // canonical ID, e.g. "qwen3:8b"
    Aliases     []string `yaml:"aliases,omitempty"`     // e.g. ["qwen3-8b", "qwen/qwen3:8b"]
    DisplayName string   `yaml:"display_name"`          // UI label
    Provider    []string `yaml:"provider"`              // ["ollama", "novita"]
    License     string   `yaml:"license,omitempty"`    // "Apache-2.0", "proprietary"

    // ---- Tiering ----
    Tier         Tier      `yaml:"tier"`
    ReleaseDate  time.Time `yaml:"release_date,omitempty"`
    CertifiedIn  string    `yaml:"certified_in,omitempty"`  // "v0.3.0"
    DeprecatedIn string    `yaml:"deprecated_in,omitempty"` // "v0.5.0"

    // ---- Capability ----
    ContextWindow   int        `yaml:"context_window"`     // tokens
    MaxOutputTokens int        `yaml:"max_output_tokens"`  // per-turn cap
    CodingTier      CodingTier `yaml:"coding_tier"`        // reuse existing enum
    DefaultRole     RoleType   `yaml:"default_role"`       // reuse existing enum
    SupportsTools   bool       `yaml:"supports_tools"`
    ToolFormat      ToolFormat `yaml:"tool_format"`
    SupportsSystem  bool       `yaml:"supports_system"`    // false → fold sys prompt into first user msg
    SupportsVision  bool       `yaml:"supports_vision,omitempty"`
    SupportsReasoning bool     `yaml:"supports_reasoning,omitempty"` // reasoning/thinking traces

    // ---- Runtime tuning ----
    PreferredTemperature float64     `yaml:"preferred_temperature"`
    ToolCallRetries      int         `yaml:"tool_call_retries"` // per-turn retry cap for bad tool JSON
    PromptStyle          PromptStyle `yaml:"prompt_style"`

    // ---- Quirks (behavioral flags) ----
    NeedsStricterJSON   bool `yaml:"needs_stricter_json,omitempty"`    // enforce response_format
    PrefersShortPrompts bool `yaml:"prefers_short_prompts,omitempty"`  // use PromptStyleShort by default
    AvoidSystemRole     bool `yaml:"avoid_system_role,omitempty"`      // some ollama models ignore system
    HatesMarkdownTables bool `yaml:"hates_markdown_tables,omitempty"`  // render plaintext instead
    NeedsToolExamples   bool `yaml:"needs_tool_examples,omitempty"`    // inject few-shot tool examples
    StripThinkingTags   bool `yaml:"strip_thinking_tags,omitempty"`    // strip <think>...</think> before display

    // ---- Resource requirements ----
    MemoryFootprintGB float64 `yaml:"memory_footprint_gb,omitempty"` // for local models
    RecommendedVRAMGB float64 `yaml:"recommended_vram_gb,omitempty"`

    // ---- Curation ----
    BestFor     []string `yaml:"best_for,omitempty"`      // ["refactoring","quick edits"]
    NotGoodFor  []string `yaml:"not_good_for,omitempty"`  // ["creative writing"]
    Notes       string   `yaml:"notes,omitempty"`         // free-form maintainer notes
}
```

### 1.3 Relationship to existing `ModelCapability`

- `ModelCapability` (in `internal/llm/capabilities.go:23-28`) stays as a **narrow view** of `ModelProfile` for backward compatibility.
- Add helper: `func (p ModelProfile) Capability() ModelCapability`.
- `GetCapability(model)` (`capabilities.go:55`) becomes a thin wrapper: `ProfileFor(model).Capability()`.

---

## 2. File Layout — Where Does the Catalog Live?

### 2.1 Options evaluated

| Option | Pros | Cons |
|---|---|---|
| A. `internal/llm/certified.go` (Go literal map) | Compile-time safety; no parser; zero startup cost | Hard to diff in release notes; contributors must know Go; churn in code review |
| B. `internal/llm/profiles/*.yaml` via `embed.FS` | Human-editable; clean per-model files; easy release-note diffs | Startup parsing (negligible); needs schema validation in CI |
| C. External `~/.hanimo/models/*.yaml` user overrides | Ship with B, **plus** allow user overrides | Needs merge/precedence rules; support burden |

### 2.2 Recommendation: **B + C (hybrid)**

**Primary:** `internal/llm/profiles/*.yaml` embedded via `//go:embed profiles/*.yaml`.
**Override:** `~/.hanimo/models/*.yaml` loaded at startup, same schema, merges over embedded.

**Precedence (highest wins):**
1. `~/.hanimo/models/<id>.yaml` (user override, warns in CLI: `[override] qwen3:8b from ~/.hanimo/models/…`)
2. Embedded `internal/llm/profiles/<id>.yaml`
3. Generic fallback profile (`TierUnknown`)

**Rationale:** YAML gives us clean per-release diffs ("model set changed" is a line item in the changelog) and lets power users fix profile bugs without rebuilding. CI runs a schema-validate step (`make validate-profiles`) so broken YAML never ships.

**Proposed layout:**

```
internal/llm/
├── capabilities.go          # stays, reduced to thin wrappers
├── profile.go               # NEW — ModelProfile struct + Tier/ToolFormat/PromptStyle
├── catalog.go               # NEW — loader, merger, lookup, probe cache
├── catalog_test.go          # NEW — schema/duplicate/tier invariants
└── profiles/
    ├── _generic.yaml        # fallback (TierUnknown)
    ├── qwen3-8b.yaml
    ├── qwen3-coder-30b.yaml
    ├── llama3.1-70b.yaml
    ├── gpt-4o.yaml
    ├── claude-sonnet-4.yaml
    └── …
```

---

## 3. Prompt Template System

### 3.1 Problem

`internal/llm/prompt.go:132-201` currently hardcodes one prompt per mode (Super / Dev / Plan) for **every** model. Small 8B local models choke on the 3-KB `clarifyFirstDirective` while Claude/GPT-4 thrive on it.

### 3.2 Design

Introduce a prompt **resolver** that takes `(Mode, ModelProfile)` and returns the specialized system prompt.

New file: `internal/llm/prompt_resolver.go`

```go
// PromptContext carries everything a prompt template needs.
type PromptContext struct {
    Mode        Mode
    Profile     ModelProfile
    ToolCatalog []ToolDef // enables tool-format-specific rendering
    Locale      string    // "ko" | "en"
}

// ResolveSystemPrompt returns the model-specialized system prompt.
// Returns (prompt, foldIntoFirstUserMessage). If foldIntoFirstUserMessage is
// true, the caller must prepend this text to the first user message instead
// of sending it as role=system (for models with AvoidSystemRole).
func ResolveSystemPrompt(pc PromptContext) (string, bool) {
    tpl := pickTemplate(pc.Mode, pc.Profile.PromptStyle)
    body := tpl.Render(pc)
    if pc.Profile.NeedsToolExamples {
        body += renderToolFewShot(pc.ToolCatalog, pc.Profile.ToolFormat)
    }
    return body, pc.Profile.AvoidSystemRole
}

type promptTemplate struct {
    Name   string
    Render func(PromptContext) string
}

var templates = map[string]promptTemplate{
    "super.full":    {Name: "super.full",    Render: renderSuperFull},
    "super.short":   {Name: "super.short",   Render: renderSuperShort},
    "super.react":   {Name: "super.react",   Render: renderSuperReAct},
    "super.minimal": {Name: "super.minimal", Render: renderSuperMinimal},
    "deep.full":     {Name: "deep.full",     Render: renderDeepFull},
    "deep.short":    {Name: "deep.short",    Render: renderDeepShort},
    "plan.full":     {Name: "plan.full",     Render: renderPlanFull},
    "plan.short":    {Name: "plan.short",    Render: renderPlanShort},
}
```

### 3.3 Template variants

| Variant | When used | What changes |
|---|---|---|
| `full` | PromptStyleFull (Claude/GPT/Qwen-32B) | Keeps the full `clarifyFirstDirective` + tool catalog + ASK_USER doc |
| `short` | PromptStyleShort (8B/13B local models) | Drops the PRIMARY DIRECTIVE block; keeps only tool list + 3 rules |
| `react` | PromptStyleReAct (llama3.1:8b tool-less) | ReAct scaffold: `Thought: … Action: … Observation: …` |
| `minimal` | PromptStyleMinimal (chat-only fallback) | Just mode description + ASK_USER rules |

### 3.4 Callsite migration

`internal/app/app.go` (or wherever `SystemPrompt(mode)` is called) must be updated to:

```go
profile := llm.ProfileFor(cfg.Models.Super)
prompt, foldIntoUser := llm.ResolveSystemPrompt(llm.PromptContext{
    Mode:        mode,
    Profile:     profile,
    ToolCatalog: toolDefs,
    Locale:      "ko",
})
```

The old `SystemPrompt(mode)` stays as a **shim** that calls the resolver with the generic profile — so nothing breaks mid-migration.

---

## 4. Auto-Detection & Fallback

### 4.1 Unknown model flow

When the user selects a model that matches **no** profile:

1. Canonicalize: strip provider prefix (`openai/gpt-4o` → `gpt-4o`), lowercase, try alias table.
2. If still no match, load `_generic.yaml` profile and mark it `Tier: TierUnknown`, `DisplayName: <raw-id> (unknown)`.
3. Show a **one-time warning banner** in the TUI:
   ```
   ⚠ Unknown model: mistral-nemo:12b
     Using generic profile. Quality may vary.
     Tip: run `hanimo --list-models` to see certified models.
   ```
4. Persist the warning-dismissal in `~/.hanimo/cache/seen-unknown-models.json` so we don't nag.

### 4.2 User opt-in override

Users can silence the warning and pick a specific profile to inherit:

```yaml
# ~/.hanimo/models/mistral-nemo-12b.yaml
id: mistral-nemo:12b
inherits: qwen3:8b        # optional: copy all fields from another profile
tier: 2
notes: "My override — works fine at temp 0.2"
preferred_temperature: 0.2
```

The loader expands `inherits` shallow-merge style (field by field, override wins).

### 4.3 Generic profile values (`_generic.yaml`)

```yaml
id: _generic
display_name: "Generic (unknown model)"
tier: 0
context_window: 8192         # conservative
max_output_tokens: 2048
coding_tier: 1               # Moderate
default_role: 1              # Assistant (read-only)
supports_tools: true
tool_format: 0               # OpenAI JSON
supports_system: true
preferred_temperature: 0.3
tool_call_retries: 2
prompt_style: 1              # Short (safer default)
prefers_short_prompts: true
best_for: []
notes: "Fallback profile. Treat as Assistant until verified."
```

Conservative defaults: read-only role, 8K context, short prompt, 2 retries. The principle is **"do less damage when we don't know."**

---

## 5. Context Budget Management

### 5.1 Current state

`internal/llm/compaction.go:26-29`:

```go
func Compact(messages []openai.ChatCompletionMessage) []openai.ChatCompletionMessage {
    if len(messages) < 40 {
        return messages
    }
    …
}
```

This is **message-count** based, not **token** based. A 40-message conversation with a qwen3:8b (32K ctx) is fine; same 40 messages with a codellama:13b (16K ctx) may already be blowing the context window, and the existing `estimateTokens` in `compaction.go:13-20` is only used in stage 3.

### 5.2 Target behavior

Compact must fire when **estimated tokens exceed `profile.ContextWindow * 0.65`** (leave headroom for response + tool results), regardless of message count. Threshold expression:

```go
compactTrigger := int(float64(profile.ContextWindow) * 0.65)
if estimateTokens(messages) < compactTrigger {
    return messages
}
```

### 5.3 API changes

Update signature:

```go
// Compact now takes the profile to size its budgets.
func Compact(profile ModelProfile, messages []openai.ChatCompletionMessage) []openai.ChatCompletionMessage
func CompactWithLLM(ctx context.Context, client *Client, profile ModelProfile, messages []openai.ChatCompletionMessage) []openai.ChatCompletionMessage
```

Budget table derived from profile:

| ContextWindow | Compact trigger (65%) | Stage-2 truncate threshold | Tail kept in stage 3 |
|---|---|---|---|
| ≤ 16K | 10,400 tok | 1,500 chars | 6 msgs |
| 32K | 20,800 tok | 3,000 chars | 10 msgs |
| 128K | 83,200 tok | 6,000 chars | 16 msgs |
| ≥ 1M | 650K tok | 12,000 chars | 24 msgs |

Expose as `func budgetForProfile(p ModelProfile) CompactBudget`.

### 5.4 Migration

Callsites in `internal/app/app.go` receive the profile from the session, not a string. Keep a `CompactLegacy(messages)` shim for tests during transition.

---

## 6. `hanimo --list-models` CLI Command

### 6.1 Command spec

```
hanimo --list-models [flags]

Flags:
  --certified          Only Tier 1 (Certified)
  --local              Only locally-runnable (provider includes "ollama")
  --cloud              Only cloud providers
  --tier=1|2|3         Filter by tier
  --provider=<name>    Filter by provider (ollama, openai, anthropic, …)
  --json               Machine-readable output
  --verbose, -v        Include MemoryFootprintGB, license, notes
```

### 6.2 Default output (human-readable, tier-grouped)

```
CERTIFIED (Tier 1) — tested every release
  qwen3:8b              32K   Agent       Ollama          4.5 GB   Best for: local quick edits
  qwen3-coder-30b       32K   Agent       Ollama         18.0 GB   Best for: refactoring
  claude-sonnet-4      200K   Agent       Anthropic        —       Best for: complex reasoning
  gpt-4o               128K   Agent       OpenAI           —       Best for: general coding
  …

SUPPORTED (Tier 2) — profile maintained
  llama3.1:70b         128K   Agent       Ollama         40.0 GB
  mistral-large        128K   Agent       Mistral          —
  …

EXPERIMENTAL (Tier 3) — best-effort
  gemma-4-26b-a4b-it   262K   Agent       Novita           —
  …

Run `hanimo --list-models --verbose` for details.
Run `hanimo --list-models --certified` to see only guaranteed models.
```

### 6.3 `--json` output

```json
{
  "version": "v0.3.0",
  "generated_at": "2026-04-11T00:00:00Z",
  "models": [
    {
      "id": "qwen3:8b",
      "tier": 1,
      "display_name": "Qwen 3 8B",
      "context_window": 32768,
      "default_role": "Agent",
      "providers": ["ollama"],
      "memory_footprint_gb": 4.5,
      "best_for": ["local quick edits"]
    }
  ]
}
```

### 6.4 Implementation location

- New subcommand in `cmd/hanimo/main.go` (or extend existing flag handling)
- Rendering logic: `internal/llm/list.go` (pure function from `[]ModelProfile` → string/JSON)
- Reuses `catalog.AllProfiles()`

---

## 7. Model Probe at Session Start (Optional)

### 7.1 Rationale

A profile says "this model supports OpenAI tool JSON," but Ollama users run custom fine-tunes that silently broke that format. We can ping the model once per session with a throwaway tool call to confirm — then cache the result so we don't re-probe for a week.

### 7.2 Probe design

`internal/llm/probe.go`

```go
type ProbeResult struct {
    ModelID          string    `json:"model_id"`
    ProbedAt         time.Time `json:"probed_at"`
    ToolFormatOK     bool      `json:"tool_format_ok"`
    SystemRoleOK     bool      `json:"system_role_ok"`
    ResponseLatencyMS int64    `json:"response_latency_ms"`
    ErrorMsg         string    `json:"error_msg,omitempty"`
}

// Probe sends a tiny test prompt with one tool definition and expects
// a tool call back. Timeout: 10 s.
func Probe(ctx context.Context, client *Client, profile ModelProfile) ProbeResult
```

### 7.3 Cache

- Path: `~/.hanimo/cache/probe-<model-id-slug>.json`
- TTL: 7 days
- On failure, surface a warning in the TUI: `⚠ <model> failed tool probe — falling back to ReAct prompt`. The session can auto-downgrade `ToolFormat → ReActText` for that run only.

### 7.4 Opt-in

Gated behind config `probe_on_start: true` (default `false` for v0.3.0 to avoid startup latency). Power users can enable.

---

## 8. Testing Strategy — `make test-certified`

### 8.1 Goal

**Prove** that every Tier 1 model can run a canned scenario suite end-to-end. Failure = model drops to Tier 2 until fixed.

### 8.2 Scenario suite

File: `internal/llm/testdata/scenarios/*.json`

| Scenario | Steps | Pass criterion |
|---|---|---|
| `list-files.json` | User: "이 디렉토리의 파일을 보여줘" | Model emits `list_files` tool call |
| `read-file.json` | User: "README.md 읽어줘" | Model emits `file_read` with correct path |
| `edit-file.json` | User: "greet.txt 에 'hi' 한 줄 추가해줘" | Model emits `file_write` or `file_edit`; resulting file contains "hi" |
| `shell-exec.json` | User: "`ls /tmp` 실행해줘" | Model emits `shell_exec` with `ls /tmp` |
| `ask-user.json` | User: "프로젝트 만들어줘" (ambiguous) | Model emits `[ASK_USER]` block, does NOT start running commands |
| `compaction.json` | 50-turn synthetic history | Conversation continues coherently after compaction |
| `multi-step.json` | User: "test.go 생성하고 go run 실행" | Both `file_write` and `shell_exec` fire in order |

Each scenario is a replayable JSON with `input`, `expected_tool_calls`, `expected_file_state`, `max_turns`.

### 8.3 Harness

`internal/llm/testcert/runner.go` — a test driver that:

1. Spins up a temp workspace
2. Runs each scenario against each Tier 1 profile
3. Records pass/fail + latency + token cost
4. Writes report to `testdata/reports/<date>-<model>.md`

Invocation:

```bash
make test-certified                   # all Tier 1 models, all scenarios
make test-certified MODEL=qwen3:8b    # single model
make test-certified SCENARIO=edit-file
```

### 8.4 CI matrix

GitHub Actions job `certified-models` runs nightly on a self-hosted runner with Ollama preloaded:

- Matrix axis 1: Tier 1 models (8-10 entries)
- Matrix axis 2: scenarios
- Fail the job if any Tier 1 × scenario fails
- Post summary to PR via bot comment for model-profile PRs

Cloud models (Claude / GPT) gated behind `CI_SECRETS` — skipped on PR forks.

### 8.5 Promotion / demotion rule

- Tier 2 → Tier 1 promotion requires **3 consecutive green nightlies** on the scenario suite.
- Tier 1 → Tier 2 demotion triggers after **2 consecutive failing nightlies** — auto-filed GitHub issue.

---

## 9. Versioning Policy

### 9.1 Certified set lifecycle

| Event | Action |
|---|---|
| New model released upstream | Community files issue with template; maintainer drafts profile; runs `test-certified`; opens PR |
| Certified model ships new minor version (e.g. qwen3:8b → qwen3.1:8b) | New profile file (do NOT overwrite); old marked `deprecated_in: vX.Y+2` |
| Certified model fails 2 nightlies | Auto-demote to Tier 2, open issue, banner warns users on startup |
| Maintainer removes model | Mark `deprecated_in`; keep profile for 2 releases with warning; delete in release N+2 |

### 9.2 Tier promotion criteria

To be promoted Tier 3 → 2:
- Profile exists and passes schema validation
- At least 2 scenarios pass manually once

To be promoted Tier 2 → 1:
- All 7 scenarios pass in CI nightly for 3 consecutive runs
- Maintainer commits to responding to issues within 7 days
- Has at least one `best_for` use case documented
- License compatible with redistribution of profile (Apache/MIT/Llama/Gemma community OK)

### 9.3 Deprecation flow

```
v0.3.0:  model X is Tier 1
v0.4.0:  model X flagged deprecated_in=v0.6.0, still loadable, warning shown
v0.5.0:  same (warning louder)
v0.6.0:  profile removed from embedded catalog, user override still works
```

---

## 10. Documentation Outputs

### 10.1 README "Supported Models" section

Auto-generated by `scripts/gen-models-readme.sh` from the embedded catalog. The script writes between markers:

```markdown
<!-- BEGIN:MODELS -->
... table rendered from catalog ...
<!-- END:MODELS -->
```

Run as part of `make release`. CI check: `make check-models-readme` asserts the file is up-to-date (diff = 0).

### 10.2 Per-release changelog entry

`scripts/gen-models-changelog.sh <prev-tag>` diffs two tags' embedded profiles and emits:

```markdown
## Certified Models

**Added (Tier 1):**
- qwen3-coder-30b — replaces qwen2.5-coder-32b as the local refactoring default

**Promoted (Tier 2 → Tier 1):**
- gemma-4-26b-a4b-it

**Deprecated (will be removed in v0.5.0):**
- codellama:13b — superseded by qwen3-coder-30b
```

### 10.3 Per-model pages

Optional Tier-1 stretch goal: `docs/models/<id>.md` with usage examples, memory footprint screenshots, best-practice config snippet.

---

## 11. Migration Plan — 18 Hardcoded Models → New System

### 11.1 Current hardcoded list

From `internal/llm/capabilities.go:31-52`:

| # | ID | Current | Target tier |
|---|---|---|---|
| 1 | gpt-4o | 128K Strong Agent | **Tier 1** |
| 2 | gpt-4o-mini | 128K Moderate Agent | Tier 2 |
| 3 | claude-sonnet-4 | 200K Strong Agent | **Tier 1** |
| 4 | claude-haiku-4 | 200K Moderate Agent | Tier 2 |
| 5 | gemini-2.5-flash | 1M Moderate Agent | Tier 2 |
| 6 | deepseek-chat | 128K Strong Agent | **Tier 1** |
| 7 | deepseek-reasoner | 128K Strong Agent | Tier 2 (reasoning-specific) |
| 8 | qwen3:8b | 32K Moderate Assistant | **Tier 1** (local default) |
| 9 | qwen3:32b | 32K Strong Agent | **Tier 1** |
| 10 | qwen3-coder-30b | 32K Strong Agent | **Tier 1** |
| 11 | llama3.1:8b | 128K Weak Chat | Tier 3 (chat-only fallback) |
| 12 | llama3.1:70b | 128K Moderate Agent | Tier 2 |
| 13 | codellama:13b | 16K Moderate Assistant | Tier 3 (deprecated path) |
| 14 | mistral-large | 128K Moderate Agent | Tier 2 |
| 15 | gpt-oss-120b | 128K Strong Agent | Tier 2 |
| 16 | gemma-4-26b-a4b-it | 262K Strong Agent | **Tier 1** |
| 17 | gemma-4-31b-it | 262K Strong Agent | Tier 2 |
| 18 | gemma-3-12b-it | 128K Moderate Agent | Tier 3 |
| 19 | gemma-3-27b-it | 128K Strong Agent | Tier 2 |

### 11.2 Phased migration

**Phase A — Additive (no breaking changes)**
1. Add `profile.go`, `catalog.go`, embedded YAML files for all 19 existing IDs.
2. `GetCapability()` internally calls `ProfileFor().Capability()` — users see no change.
3. Ship as a hidden feature behind `HANIMO_EXPERIMENTAL_PROFILES=1`.

**Phase B — Prompt resolver**
4. Add `ResolveSystemPrompt()`. `SystemPrompt(mode)` still exists as a shim.
5. Opt-in via config `experimental.use_profile_prompts: true`.

**Phase C — Token compaction**
6. `Compact(profile, messages)` shipped; old `Compact(messages)` deprecated but kept.
7. Run both in dev mode and log divergence for 1 week.

**Phase D — CLI + public launch**
8. `hanimo --list-models` added.
9. Unknown-model warning banner enabled.
10. `use_profile_prompts` flipped to default `true`.
11. Old `knownModels` map deleted. `capabilities.go` reduced to <30 lines of adapter code.

**Phase E — Cleanup**
12. Delete legacy shims in v0.4.0.

### 11.3 Backward-compat invariants

- Existing `~/.hanimo/config.yaml` must load unchanged.
- `HANIMO_MODEL_SUPER=foo` env var still works.
- Models referenced by config but absent from catalog fall through to `_generic` profile — **never error out at startup**.

---

## 12. Concrete Tier 1 Recommendation for v0.3.0

The research docs (`ollama-models-catalog.md`, `cloud-models-and-auth.md`) were not available at plan authoring time. The following list is based on the existing `capabilities.go` map and general knowledge — **tomorrow's executor should cross-check against the research docs if they exist.**

### 12.1 Proposed Tier 1 set (9 models)

| # | ID | Provider | Ctx | Why |
|---|---|---|---|---|
| 1 | **qwen3:8b** | Ollama | 32K | Local default — smallest viable agent. Excellent tool-call JSON. Runs on 8 GB VRAM / 16 GB RAM. The "everyone can try Hanimo" entry point. |
| 2 | **qwen3:32b** | Ollama | 32K | Local premium — near-frontier coding ability at ~20 GB. For power users with a decent GPU. |
| 3 | **qwen3-coder-30b** | Ollama | 32K | Local coding specialist — beats qwen3:32b on refactoring and multi-file edits. Current hanimo-recommended default for code work. |
| 4 | **gemma-4-26b-a4b-it** | Novita / HF | 262K | Long-context local option. 262K ctx makes it great for "read entire codebase" flows. MoE architecture → fast. |
| 5 | **gpt-4o** | OpenAI | 128K | Cloud flagship #1. Unquestioned tool-call reliability. The baseline we benchmark everything else against. |
| 6 | **gpt-4o-mini** | OpenAI | 128K | Cloud budget tier. ~15× cheaper than gpt-4o, still solid for edits. Important for cost-conscious users. |
| 7 | **claude-sonnet-4** | Anthropic | 200K | Cloud flagship #2. Best-in-class for complex reasoning + long refactors. Worth certifying for the users who prefer Claude style. |
| 8 | **deepseek-chat** | DeepSeek | 128K | Cloud value tier. Strong coding, very cheap. Popular with Korean dev audience (main hanimo market). |
| 9 | **gemini-2.5-flash** | Google | 1M | Massive-context option. Unique value: "drop your entire monorepo in context." |

### 12.2 Why this specific mix

- **3 local (Ollama) + 6 cloud** — reflects hanimo's dual identity ("works offline, also great with cloud").
- **Covers 4 cost points:** free local, cheap cloud (deepseek, 4o-mini), mid (sonnet, flash), premium (4o).
- **Covers 3 context sizes:** 32K, 128-200K, 262K-1M.
- **All have native OpenAI/Anthropic/Gemini tool-call format** → no ReAct hackery in Tier 1.
- **Excludes llama3.1:8b** (tool-calling unreliable — lives in Tier 3).
- **Excludes codellama:13b** (deprecated, superseded by qwen3-coder-30b).
- **Excludes deepseek-reasoner** from Tier 1 (reasoning models have their own prompt-style quirks; park in Tier 2 until the `SupportsReasoning` code path is built).

### 12.3 Headline marketing number

**"v0.3.0 ships with 9 hand-tuned models guaranteed to work — from free local Qwen to GPT-4o."**

---

## 13. Edge Cases & Open Questions

### 13.1 Model without tool calling (chat-only)

- Detection: `SupportsTools: false` in profile
- Behavior: Force `RoleChat`; replace tool-using modes with a ReAct scaffold that parses `Action:/Observation:` text and synthesizes tool calls client-side
- Implementation: new `react_parser.go` — converts ReAct text → `ToolCall` structs
- UX: warn in banner ("limited mode: no direct tool use")

### 13.2 Unreliable JSON (small models)

- Profile flag: `NeedsStricterJSON: true` + `ToolCallRetries: 3`
- Strategy:
  1. Request with `response_format: {"type":"json_object"}` when provider supports it
  2. On parse failure, auto-retry up to `ToolCallRetries` with an **error-correction prompt**: "Your last response had invalid JSON. Emit ONLY a valid JSON tool call. Error: <err>"
  3. After retries exhausted, surface error to user + suggest switching to a Tier 1 model

### 13.3 Tiny context (8K-16K)

- `codellama:13b` (16K), hypothetical 8K models
- Strategy:
  - Compact trigger drops to ~35% of context (not 65%) to leave room for tool results
  - PromptStyle forced to `Short`
  - Tool catalog reduced (drop `shell_exec` description down to 1 line)
  - Max 3 files in a single read session before forced compaction
  - Warn: `⚠ 16K context — consider qwen3:8b for larger tasks`

### 13.4 Huge context (262K - 1M+)

- `gemini-2.5-flash` (1M), `gemma-4-*` (262K)
- Strategy:
  - Compact trigger at 65% still applies but absolute numbers are enormous → compaction rarely fires
  - Stage 3 LLM summary becomes unnecessary at 1M
  - **New flag** `profile.SkipStage3: true` for giant contexts
  - UI can offer "full-repo mode" that loads entire file tree as context

### 13.5 Open questions (need user input)

1. **Should unknown-model warning block or just notify?** Currently proposed as non-blocking banner. Strict mode could refuse to start.
2. **Do we publish the profile schema as a public JSON Schema?** Enables third-party profile authoring tools.
3. **Probe-on-start default value** — `false` for latency reasons in v0.3.0; revisit for v0.4.0.
4. **Tier 1 size cap** — hard cap at 10, or flexible 8-12?
5. **Cost tracking per profile** — should `ModelProfile` carry token $/price fields to power a "session cost" UI?
6. **Gemma-4 availability** — if gemma-4 is not yet GA on Novita at release time, demote to Tier 2 and replace Tier 1 slot with something else. Decision point.
7. **Multi-locale prompts** — `Locale` field exists in `PromptContext` but only Korean shipped initially. When do we add English-native prompts?

---

## 14. Non-Goals (Explicit)

This plan does **NOT** attempt to:

1. Fine-tune or train any model. Hanimo only curates and prompts.
2. Guarantee every provider endpoint (e.g. random OpenRouter routes) works.
3. Build a model marketplace or profile sharing hub. Users can share YAML files manually.
4. Replace Ollama's model pull/management — we assume the model is already available at the endpoint.
5. Solve hallucination / content moderation / safety filtering.
6. Support non-chat models (embedding models, classifiers).
7. Abstract away provider-specific billing APIs.
8. Implement a universal benchmark (SWE-bench, HumanEval, etc.) — the scenario suite is **regression testing**, not ranking.
9. Support every reasoning-model quirk (o1, o3, deepseek-reasoner thinking tags) in v0.3.0 — parked for v0.4.0.
10. Dynamically swap models mid-session. Model is session-scoped.
11. Provide a GUI for editing profiles. CLI + YAML file editing is sufficient.

---

## 15. Implementation Phases (PR-sized chunks)

Each phase is one PR. Each PR must pass `go vet`, `go test ./…`, and add/update tests.

### Phase 1 — Profile data model + loader (Foundation)

**Scope:**
- Create `internal/llm/profile.go` (struct, enums)
- Create `internal/llm/catalog.go` (embed.FS loader, lookup, alias resolution, merger for user overrides)
- Create `internal/llm/profiles/_generic.yaml` and 4 seed profiles: `qwen3-8b`, `gpt-4o`, `claude-sonnet-4`, `deepseek-chat`
- Create `internal/llm/catalog_test.go` — asserts no duplicate IDs, no duplicate aliases, all Tier-1 profiles have `BestFor` set, schema validates
- `GetCapability()` rewritten as thin wrapper over `ProfileFor().Capability()` — behavior-identical

**Acceptance criteria:**
- `go test ./internal/llm/...` green
- Running hanimo with any of the 4 seed models behaves exactly as before
- `ProfileFor("unknown-model-xyz")` returns `_generic` with `Tier: TierUnknown`
- Catalog loads in <5 ms at startup (benchmark added)

**Files touched:** new files only except `capabilities.go` (trimmed)

---

### Phase 2 — Prompt resolver + Compact with profile

**Scope:**
- Create `internal/llm/prompt_resolver.go` with `PromptContext`, `ResolveSystemPrompt`, and 4 template variants (`super.full`, `super.short`, `deep.full`, `plan.full`)
- Port existing `SystemPrompt(mode)` text into `super.full` / `deep.full` / `plan.full` templates (byte-identical output for full style)
- Add `super.short` variant (trimmed directive, ~500 chars instead of 3 KB)
- Update `internal/llm/compaction.go`: `Compact(profile, messages)` and `CompactWithLLM(…, profile, …)`, keep old signatures as deprecated shims
- Wire callsites in `internal/app/app.go` to pass profile through (behind `HANIMO_EXPERIMENTAL_PROFILES=1` env gate)

**Acceptance criteria:**
- With env unset: no behavior change (legacy path)
- With env set + `qwen3:8b`: system prompt is `super.short`, shorter than before
- Compact trigger is token-based: synthetic 50-message small-ctx test triggers compaction earlier than before
- Tests: snapshot test per `(mode, style)` template combination
- `go test ./...` green

**Files touched:** `prompt.go`, `compaction.go`, `app/app.go`, new `prompt_resolver.go`

---

### Phase 3 — Migrate all 19 models + unknown-model UX

**Scope:**
- Author YAML for the remaining 15 models (all of `capabilities.go:31-52` minus the 4 from Phase 1)
- Assign tiers per §11.1
- Add alias map (e.g. `openai/gpt-4o` → `gpt-4o`)
- Implement unknown-model warning banner in TUI (`internal/ui/…`)
- Persist seen-unknown list at `~/.hanimo/cache/seen-unknown-models.json`
- Delete `knownModels` literal from `capabilities.go`

**Acceptance criteria:**
- All 19 previously-hardcoded IDs resolve to a profile with matching capability
- Running hanimo with a made-up model ID shows the banner exactly once per session and once per new ID across sessions
- `capabilities.go` is <50 lines
- `go test ./...` green; new test asserts every ID from the old map is still resolvable

**Files touched:** `capabilities.go`, `internal/ui/*.go` (banner), new YAMLs

---

### Phase 4 — `hanimo --list-models` CLI + README auto-gen

**Scope:**
- Add `--list-models` subcommand in `cmd/hanimo/main.go`
- Implement `internal/llm/list.go` (renderer: human / JSON / tier-grouped)
- Add all filter flags (`--certified`, `--tier`, `--local`, `--cloud`, `--provider`, `--json`, `-v`)
- Add `scripts/gen-models-readme.sh` using `hanimo --list-models --json`
- Add `<!-- BEGIN:MODELS -->` / `<!-- END:MODELS -->` markers in README
- CI check: `make check-models-readme`

**Acceptance criteria:**
- `hanimo --list-models --certified` lists exactly the 9 Tier 1 models
- `hanimo --list-models --json | jq '.models | length'` returns 19
- README has auto-generated section committed
- CI fails if README drifts from catalog

**Files touched:** `cmd/hanimo/main.go`, new `list.go`, `README.md`, new script, `Makefile`, CI workflow

---

### Phase 5 — Certified test suite + nightly CI

**Scope:**
- Create `internal/llm/testdata/scenarios/*.json` (7 scenarios from §8.2)
- Create `internal/llm/testcert/runner.go`
- Add `make test-certified` target
- Add GitHub Actions workflow `certified-nightly.yml` (self-hosted runner with Ollama)
- Document runner requirements in `docs/ci-runner-setup.md`
- Write up promotion/demotion policy in `docs/governance/model-tiers.md`

**Acceptance criteria:**
- `make test-certified MODEL=qwen3:8b` runs locally (if Ollama present) and produces a report
- Workflow file validated with `act` or manual dry-run
- At least 3 scenarios (list-files, read-file, ask-user) pass against qwen3:8b in dev
- Tier 1 models that fail produce a clear report file

**Files touched:** new test dirs, new `.github/workflows/certified-nightly.yml`, new docs

---

### Phase 6 (stretch, optional for v0.3.0)

- Probe-on-start (`internal/llm/probe.go`)
- ReAct parser for chat-only models
- Per-model doc pages
- Cost fields in ModelProfile

These can slip to v0.3.1 without blocking the v0.3.0 launch narrative.

---

## Appendix A — Example Profile YAMLs

### A.1 `profiles/qwen3-8b.yaml` (Tier 1 local)

```yaml
id: qwen3:8b
aliases:
  - qwen3-8b
  - qwen/qwen3:8b
  - ollama/qwen3:8b
display_name: "Qwen 3 8B"
provider: [ollama]
license: "Apache-2.0"

tier: 1
certified_in: "v0.3.0"
release_date: 2025-02-15

context_window: 32768
max_output_tokens: 4096
coding_tier: 1          # Moderate
default_role: 0         # Agent
supports_tools: true
tool_format: 0          # OpenAI JSON
supports_system: true

preferred_temperature: 0.2
tool_call_retries: 2
prompt_style: 1         # Short

prefers_short_prompts: true
strip_thinking_tags: true
memory_footprint_gb: 4.5
recommended_vram_gb: 8

best_for:
  - "로컬 빠른 편집"
  - "오프라인 작업"
  - "작은 리팩터링"
not_good_for:
  - "장문 아키텍처 설계"
notes: "The local default. Budget-friendly, runs on a laptop GPU."
```

### A.2 `profiles/claude-sonnet-4.yaml` (Tier 1 cloud)

```yaml
id: claude-sonnet-4
aliases:
  - anthropic/claude-sonnet-4
  - claude-sonnet-4-20250101
display_name: "Claude Sonnet 4"
provider: [anthropic]
license: "proprietary"

tier: 1
certified_in: "v0.3.0"

context_window: 200000
max_output_tokens: 8192
coding_tier: 0          # Strong
default_role: 0         # Agent
supports_tools: true
tool_format: 1          # Anthropic
supports_system: true

preferred_temperature: 0.3
tool_call_retries: 1
prompt_style: 0         # Full

best_for:
  - "복잡한 리팩터링"
  - "장문 코드베이스 분석"
  - "아키텍처 설계"
notes: "Best-in-class for long-running deep agent mode."
```

### A.3 `profiles/_generic.yaml` (fallback)

```yaml
id: _generic
display_name: "Generic (unknown model)"
provider: []
tier: 0

context_window: 8192
max_output_tokens: 2048
coding_tier: 1          # Moderate
default_role: 1         # Assistant
supports_tools: true
tool_format: 0
supports_system: true

preferred_temperature: 0.3
tool_call_retries: 2
prompt_style: 1         # Short
prefers_short_prompts: true

notes: "Fallback profile. Conservative defaults. Treat as Assistant until verified."
```

---

## Appendix B — File reference index

| Path | Role | Status after plan |
|---|---|---|
| `internal/llm/capabilities.go` | Legacy capability map | Trimmed to thin wrapper (<50 LOC) |
| `internal/llm/profile.go` | **NEW** struct + enums | Created in Phase 1 |
| `internal/llm/catalog.go` | **NEW** loader/lookup | Created in Phase 1 |
| `internal/llm/catalog_test.go` | **NEW** invariants | Created in Phase 1 |
| `internal/llm/profiles/*.yaml` | **NEW** embedded catalog | Phase 1 seed + Phase 3 full |
| `internal/llm/prompt.go` | Mode → prompt text | Becomes shim calling resolver |
| `internal/llm/prompt_resolver.go` | **NEW** template selector | Created in Phase 2 |
| `internal/llm/compaction.go` | Compact logic | Gains `profile` parameter in Phase 2 |
| `internal/llm/probe.go` | **NEW** (stretch) | Phase 6 |
| `internal/llm/list.go` | **NEW** renderer | Phase 4 |
| `internal/llm/testcert/runner.go` | **NEW** scenario runner | Phase 5 |
| `internal/llm/testdata/scenarios/*.json` | **NEW** scenario defs | Phase 5 |
| `internal/config/config.go` | Config schema | Adds `experimental.use_profile_prompts` field in Phase 2 |
| `cmd/hanimo/main.go` | CLI entry | Adds `--list-models` in Phase 4 |
| `internal/ui/*` | TUI | Unknown-model banner in Phase 3 |
| `README.md` | Docs | Auto-generated model table in Phase 4 |
| `.github/workflows/certified-nightly.yml` | CI | Phase 5 |

---

## Appendix C — Rollout checklist for v0.3.0 release day

- [ ] All 5 phases merged
- [ ] `make test-certified` green on all 9 Tier 1 models (local + CI)
- [ ] README "Supported Models" section up-to-date
- [ ] Changelog generated via `gen-models-changelog.sh`
- [ ] `hanimo --list-models --certified` output screenshot added to release notes
- [ ] Announcement blog post headline: "Hanimo v0.3.0 — 9 hand-tuned models, zero guesswork"
- [ ] Backward-compat smoke test: v0.2.0 config.yaml loads unchanged in v0.3.0
- [ ] Known-issues section in release notes lists which Tier 2/3 models are explicitly *not* guaranteed

---

**End of plan.** Ready for executor tomorrow.

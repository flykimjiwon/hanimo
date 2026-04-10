# Open-Source LLM Harness Tactics for hanimo
# 오픈소스 LLM 하네스 전술 — hanimo 적용 연구

> **Research Date / 조사일**: 2026-04-11  
> **Researcher**: document-specialist agent (claude-sonnet-4-6)  
> **Scope**: Battle-tested tactics from Aider, Cline, Roo Code, Continue.dev, OpenCode, Hermes-Function-Calling  
> **Purpose**: Inform hanimo v0.3.0 open-model harness design

---

## Table of Contents / 목차

1. [Executive Summary](#executive-summary)
2. [Category A: Tool Call Repair / Fallback](#category-a-tool-call-repair--fallback)
3. [Category B: Prompt Format Negotiation](#category-b-prompt-format-negotiation)
4. [Category C: Edit Format Selection](#category-c-edit-format-selection)
5. [Category D: Context Budget Adaptation](#category-d-context-budget-adaptation)
6. [Category E: Retry / Rate-Limit / Overload Handling](#category-e-retry--rate-limit--overload-handling)
7. [Category F: Tool Result Shaping](#category-f-tool-result-shaping)
8. [Category G: Agent Loop Discipline](#category-g-agent-loop-discipline)
9. [Recommended Adoption List for hanimo v0.3.0](#recommended-adoption-list-for-hanimo-v030)
10. [Source Index](#source-index)

---

## Executive Summary
## 요약

오픈소스 소형/중형 모델(Qwen, Llama, DeepSeek, Gemma 등)은 프론티어 모델(Claude, GPT-4)과 달리 다음과 같은 고유한 문제를 일으킨다:

1. JSON tool call 대신 산문(prose)이나 XML을 출력
2. 요청하지 않은 파일을 수정하거나 lazy하게 `...` 생략
3. 시스템 프롬프트를 무시하거나 ChatML/Llama3 등 특정 포맷을 기대
4. 컨텍스트 창이 작아 긴 대화에서 이전 지시를 잊음
5. Rate-limit 없이도 응답이 느리고 불안정

Open-source small/mid models (Qwen, Llama, DeepSeek, Gemma, etc.) differ from frontier models (Claude, GPT-4) in these failure modes:

1. Output prose or XML instead of JSON tool calls
2. Lazily truncate code with `...` or modify unrequested files
3. Ignore system prompts or expect specific chat templates (ChatML/Llama3)
4. Forget earlier instructions due to small context windows
5. Slow and unstable responses even without rate limits

The six projects studied provide complementary solutions. This document organizes them by tactic category with direct source citations and Go-adaptation notes for hanimo.

---

## Category A: Tool Call Repair / Fallback
## A카테고리: 도구 호출 복구 / 폴백

### A-1: XML Wrapping + Dual JSON Parser (Hermes-Function-Calling)

**Problem / 문제**: Open-weight models fine-tuned on Hermes data emit tool calls inside `<tool_call>` XML tags with JSON inside. The JSON may be malformed (single quotes, trailing commas, Python dict literals).

**Source**:  
- `utils.py`, `validate_and_extract_tool_calls()` — https://github.com/NousResearch/Hermes-Function-Calling/blob/main/utils.py  
- `validator.py` — https://github.com/NousResearch/Hermes-Function-Calling/blob/main/validator.py

**How it works**:

```python
# utils.py — wrap entire assistant output in <root> to handle multiple tool calls
def validate_and_extract_tool_calls(assistant_content):
    xml_root_element = f"<root>{assistant_content}</root>"
    root = ET.fromstring(xml_root_element)

    for element in root.findall(".//tool_call"):
        json_text = element.text.strip()
        try:
            # Pass 1: standard JSON
            json_data = json.loads(json_text)
        except json.JSONDecodeError:
            try:
                # Pass 2: Python literal eval (handles single quotes, etc.)
                json_data = ast.literal_eval(json_text)
            except (SyntaxError, ValueError):
                error_message = "JSON parsing failed with both methods"
                continue
        tool_calls.append(json_data)
```

```python
# validator.py — 3-tier JSON extraction fallback
try:
    result_json = json.loads(json_object)
except json.decoder.JSONDecodeError:
    result_json = ast.literal_eval(json_object)
except (SyntaxError, ValueError):
    result_json = extract_json_from_markdown(json_object)
```

**Error messages injected back to model for self-repair**:
```python
"Type mismatch for parameter {arg_name}. Expected: {arg_type}, Got: {type(arg_value)}"
"Invalid value '{arg_value}' for parameter {arg_name}. Expected one of {values}"
"Missing required arguments: {missing_arguments}"
```

**Applicability to hanimo (Go)**:  
Direct port. Use `encoding/xml` + `encoding/json` + fallback to `github.com/tidwall/gjson` for lenient JSON. Wrap model output in `<root>...</root>` before XML parsing.

```go
// Go adaptation sketch
func extractToolCalls(output string) ([]ToolCall, error) {
    wrapped := "<root>" + output + "</root>"
    // Parse with encoding/xml
    // For each <tool_call> element, try json.Unmarshal first
    // fallback: use gjson or custom lenient parser
}
```

---

### A-2: Schema-Validated Repair Loop with Structured Error Feedback (Hermes)

**Problem / 문제**: Model emits tool call with wrong argument types or missing required fields.

**Source**: `functioncall.py`, `recursive_loop()` — https://github.com/NousResearch/Hermes-Function-Calling/blob/main/functioncall.py

**How it works**:
```python
def recursive_loop(prompt, completion, depth=0):
    validation, tool_calls, error_message = validate_and_extract_tool_calls(assistant_message)

    if not validation:
        # Append error to conversation and re-prompt
        prompt.append({"role": "user", "content": f"Tool call failed: {error_message}. Please call again with correct arguments within <tool_call></tool_call>"})
        depth += 1
        if depth >= max_depth:  # default: 5
            return
        completion = run_inference(prompt)
        recursive_loop(prompt, completion, depth)
```

**Applicability to hanimo**: Must-have. Implement as `repairLoop(ctx, attempt int, lastError string)` with `maxRepairAttempts = 3` (more conservative than Hermes's 5).

---

### A-3: Fuzzy Filename Matching for Edit Targets (Aider)

**Problem / 문제**: Model outputs a filename like `src/foo.py` but the real path is `./src/foo.py` or just `foo.py`.

**Source**: `aider/coders/editblock_coder.py`, `find_filename()` — https://github.com/paul-gauthier/aider/blob/main/aider/coders/editblock_coder.py

**How it works**:
```python
def find_filename(filenames, valid_fnames):
    # 1. Exact match
    for fname in filenames:
        if fname in valid_fnames:
            return fname

    # 2. Basename match
    for fname in filenames:
        for vfn in valid_fnames:
            if fname == Path(vfn).name:
                return vfn

    # 3. Fuzzy match via difflib (cutoff=0.8)
    close_matches = difflib.get_close_matches(fname, valid_fnames, n=1, cutoff=0.8)
    if close_matches:
        return close_matches[0]
```

**Applicability to hanimo**: Should-have. Go has no stdlib fuzzy match; use `github.com/schollz/closestmatch` or implement Levenshtein with 80% threshold.

---

### A-4: Model-Variant Tool Specification (Cline/Roo Code)

**Problem / 문제**: Different frontier models need slightly different tool definitions. GPT-5 wants absolute paths; Gemini-3 forbids destructive ops in plan mode; generic models get full verbose descriptions.

**Source**: `src/core/prompts/system-prompt/tools/execute_command.ts` — https://github.com/cline/cline/blob/main/src/core/prompts/system-prompt/tools/execute_command.ts

**How it works**:
```typescript
export const execute_command_variants: ClineToolSpec[] = [
  {
    variant: "GENERIC",
    id: ClineDefaultTool.BASH,
    name: "execute_command",
    description: "...",
    parameters: [
      { name: "command", required: true, type: "string" },
      { name: "requires_approval", required: true, type: "boolean",
        instruction: "A boolean indicating whether this command requires explicit user approval" }
    ]
  },
  {
    variant: "NATIVE_GPT_5",
    // streamlined version for GPT-5
  },
  {
    variant: "GEMINI_3",
    // adds: contextRequirements: "forbidden when in PLAN MODE"
  }
]
```

**Applicability to hanimo**: Nice-to-have for v0.3.0. Implement as `ToolSpec` struct with `ModelTier` field: `TierSmall | TierMid | TierFrontier`. Small models get fewer, simpler tools.

---

### A-5: Accept Both XML and JSON Tool Calls (Cline Architecture)

**Problem / 문제**: Some models output XML-wrapped tool calls; others emit JSON. Both must be accepted.

**Source**: Cline's `PromptRegistry` with `enableNativeToolCalls` flag — https://github.com/cline/cline/blob/main/src/core/prompts/system-prompt/index.ts

**How it works**:
```typescript
const tools = context.enableNativeToolCalls ? registry.nativeTools : undefined
// If enableNativeToolCalls=false, model uses XML format:
// <execute_command><command>ls -la</command></execute_command>
// If enableNativeToolCalls=true, model uses provider native JSON tool calls
```

The system detects which format the model supports and configures accordingly. Models that don't support native tool calling get the XML format in their system prompt.

**Applicability to hanimo**: Must-have. Add `ToolCallMode` enum: `ToolCallModeNative | ToolCallModeXML | ToolCallModeText`. Detect from model name/capability registry.

---

## Category B: Prompt Format Negotiation
## B카테고리: 프롬프트 포맷 협상

### B-1: Per-Model-Family Chat Template Selection (Continue.dev)

**Problem / 문제**: Open-weight models have specific chat templates baked into their weights. Using the wrong template causes the model to ignore instructions or hallucinate.

**Source**: `core/llm/templates/chat.ts` + `core/llm/autodetect.ts` — https://github.com/continuedev/continue/blob/main/core/llm/templates/chat.ts

**Templates implemented**:

```typescript
// Llama 2
`[INST] <<SYS>>\n${system}\n<</SYS>>\n\n${user} [/INST]\n${assistant}`

// Llama 3 / Llama 3.1+
`<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${system}<|eot_id|>
<|start_header_id|>user<|end_header_id|>\n${user}<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>\n`

// ChatML (Qwen, Mistral-instruct via OpenHermes, Yi, etc.)
`<|im_start|>system\n${system}<|im_end|>
<|im_start|>user\n${user}<|im_end|>
<|im_start|>assistant\n`

// Gemma / Gemma 2 / Gemma 3
`<start_of_turn>user\n${user}<end_of_turn>
<start_of_turn>model\n`

// DeepSeek Coder (hardcoded system context)
// Has built-in system message about being DeepSeek Coder

// Alpaca (older instruction-tuned models)
`Below is an instruction...\n\n### Instruction:\n${user}\n\n### Response:\n`
```

**Auto-detection from model name**:
```typescript
function autodetectTemplateType(model: string): TemplateType {
    const lower = model.toLowerCase();
    if (lower.includes("llama3") || lower.includes("llama-3")) return "llama3";
    if (lower.includes("gemma")) return "gemma";
    if (lower.includes("deepseek")) return "deepseek";
    if (lower.includes("mistral") || lower.includes("mixtral")) return "llama2";
    if (lower.includes("qwen")) return "chatml";  // Qwen uses ChatML
    if (lower.includes("yi")) return "chatml";
    // default: chatml for unknown models
}
```

**Applicability to hanimo**: Must-have. Hanimo targets Ollama which handles template injection at the server level for `/api/chat` — but for raw `/api/generate` or OpenAI-compatible endpoints, Go must apply templates manually.

```go
// Go adaptation
type ChatTemplate int
const (
    TemplateChatML ChatTemplate = iota
    TemplateLlama3
    TemplateLlama2
    TemplateGemma
    TemplateDeepSeek
    TemplateAlpaca
    TemplateNone // use messages API directly
)

func DetectTemplate(modelName string) ChatTemplate {
    lower := strings.ToLower(modelName)
    switch {
    case strings.Contains(lower, "llama-3"), strings.Contains(lower, "llama3"):
        return TemplateLlama3
    case strings.Contains(lower, "gemma"):
        return TemplateGemma
    case strings.Contains(lower, "qwen"), strings.Contains(lower, "yi"),
         strings.Contains(lower, "hermes"), strings.Contains(lower, "mistral"):
        return TemplateChatML
    case strings.Contains(lower, "deepseek"):
        return TemplateDeepSeek
    default:
        return TemplateChatML
    }
}
```

---

### B-2: `use_system_prompt = false` for Models that Ignore System Role (Aider)

**Problem / 문제**: Some models (O1, O3, older instruction-tuned models) ignore or mishandle the `system` role in the messages array. Instructions must go into the first `user` message instead.

**Source**: `aider/models.py`, `ModelSettings` dataclass — https://github.com/paul-gauthier/aider/blob/main/aider/models.py

```python
@dataclass
class ModelSettings:
    use_system_prompt: bool = True
    # ...

# For O1/O3:
ModelSettings("o1", use_system_prompt=False, use_temperature=False)
ModelSettings("o3", use_system_prompt=False, use_temperature=False)
```

When `use_system_prompt=False`, Aider prepends the system instruction to the first user message instead of using the `system` role.

**Applicability to hanimo**: Should-have. Add `SystemPromptMode` to model config: `SystemPromptModeSystem | SystemPromptModeFirstUser | SystemPromptModeNone`.

---

### B-3: `reminder` — Reinject Key Rules Every N Turns (Aider)

**Problem / 문제**: Small models "forget" the system prompt rules after several turns of conversation. The system prompt is technically in context but attention weakens on it.

**Source**: `aider/models.py` + `aider/coders/base_coder.py`, `format_chat_chunks()` — https://github.com/paul-gauthier/aider/blob/main/aider/coders/base_coder.py

```python
@dataclass
class ModelSettings:
    reminder: str = "user"  # "user" | "sys" | "none"

# In format_chat_chunks() (lines 975-1009):
if self.main_model.reminder == "sys":
    # Append reminder as additional system message
    chunks.reminder = reminder_message
elif self.main_model.reminder == "user":
    # Append reminder text to the final user message
    new_content = final["content"] + "\n\n" + reminder_text
```

The `system_reminder` prompt text (injected into every final user turn) contains the most critical behavioral rules: edit format, file naming conventions, what NOT to do.

**Applicability to hanimo**: Must-have. After every 3 assistant turns, append a condensed rule reminder to the next user message. Especially important for models < 14B.

---

### B-4: `lazy` and `overeager` Correction Prompts (Aider)

**Problem / 문제**:
- **Lazy models** output `# ... existing code ...` or `pass` placeholders instead of full implementations
- **Overeager models** modify files that were never mentioned, "improving" things that weren't asked

**Source**: `aider/models.py` + `aider/coders/base_coder.py`, `fmt_system_prompt()` — https://github.com/paul-gauthier/aider/blob/main/aider/coders/base_coder.py

```python
# In fmt_system_prompt() (lines 838-850):
final_reminders = []
if self.main_model.lazy:
    final_reminders.append(self.gpt_prompts.lazy_prompt)
if self.main_model.overeager:
    final_reminders.append(self.gpt_prompts.overeager_prompt)
```

The `lazy_prompt` text explicitly says something like:  
> "Do NOT use placeholder comments like `# ... existing code here ...`. Always output the COMPLETE file content."

The `overeager_prompt` text says something like:  
> "Only make changes to files that are explicitly part of this task. Do NOT edit other files."

**Applicability to hanimo**: Must-have. These are two of the most common open-model failure modes. Implement as boolean flags in model config, appended to system prompt.

---

### B-5: `examples_as_sys_msg` — Move Few-Shot Examples to System Message (Aider)

**Problem / 문제**: Some models treat the first few messages as "history" and don't generalize from user/assistant examples as effectively as from system-level examples.

**Source**: `aider/models.py`, `ModelSettings.examples_as_sys_msg` — https://github.com/paul-gauthier/aider/blob/main/aider/models.py

```python
@dataclass
class ModelSettings:
    examples_as_sys_msg: bool = False
```

When `True`, few-shot edit format examples are injected into the system message rather than as early user/assistant turns.

**Applicability to hanimo**: Nice-to-have. Implement for models where few-shot in user turns doesn't help.

---

### B-6: `use_temperature = False` for Reasoning/Instruct Models (Aider)

**Problem / 문제**: DeepSeek R1, O1, O3 and similar reasoning models malfunction when temperature is set (they have internal chain-of-thought that temperature disrupts).

**Source**: `aider/models.py` — https://github.com/paul-gauthier/aider/blob/main/aider/models.py

```python
ModelSettings("deepseek/deepseek-reasoner", 
    reasoning_tag="think",
    use_temperature=False,
    remove_reasoning="think")  # strip <think>...</think> from output before parsing

ModelSettings("o1", use_temperature=False, use_system_prompt=False)
```

**Applicability to hanimo**: Must-have. DeepSeek R1/R2 is a primary target. Add `UseTemperature bool` and `ReasoningTag string` fields to model config.

---

### B-7: `reasoning_tag` — Strip Chain-of-Thought Before Parsing (Aider)

**Problem / 문제**: DeepSeek R1 and similar reasoning models wrap their internal CoT in `<think>...</think>` tags. This CoT must be stripped before trying to parse tool calls or edit blocks, otherwise the parser chokes on thousands of tokens of reasoning prose.

**Source**: `aider/models.py`, `remove_reasoning` field — https://github.com/paul-gauthier/aider/blob/main/aider/models.py

```python
ModelSettings("deepseek/deepseek-reasoner",
    reasoning_tag="think",        # tag name wrapping CoT
    remove_reasoning="think",     # strip before parsing
    use_temperature=False)
```

**Applicability to hanimo**: Must-have for DeepSeek R1/R2, QwQ, and any model with visible CoT. Strip `<think>...</think>` blocks from model output before passing to tool call parser.

```go
// Go adaptation
func stripReasoning(output, tag string) string {
    open := "<" + tag + ">"
    close := "</" + tag + ">"
    for {
        start := strings.Index(output, open)
        if start == -1 { break }
        end := strings.Index(output[start:], close)
        if end == -1 { break }
        output = output[:start] + output[start+end+len(close):]
    }
    return strings.TrimSpace(output)
}
```

---

## Category C: Edit Format Selection
## C카테고리: 편집 포맷 선택

### C-1: The Four Edit Formats and When to Use Each (Aider)

**Problem / 문제**: No single edit format works for all model sizes and contexts. Using unified diff with a 7B model reliably produces malformed hunks.

**Source**: Aider coder architecture — https://github.com/paul-gauthier/aider/tree/main/aider/coders/

**The four formats**:

| Format | Class | Token Cost | Model Requirement | Failure Mode |
|--------|-------|-----------|-------------------|--------------|
| `whole` | `WholeFileCoder` | High (full file) | Any (safest) | None — just overwrites |
| `diff` | `EditBlockCoder` | Medium | 14B+ | Fuzzy SEARCH fails |
| `udiff` | `UnifiedDiffCoder` | Low | 34B+ | Malformed hunks |
| `ask` | `AskCoder` | Minimal | Any | N/A (read-only) |

**`whole` format** (WholeFileCoder) — safest for weak models:
```
# Model outputs entire file in fenced block:
path/to/file.py
```python
# complete file content here
```
```
Parser extracts filename from line before fence, overwrites entire file. No diff logic needed. Handles model hallucinating wrong line numbers.

**`diff` (SEARCH/REPLACE blocks)** — Aider's sweet spot:
```
------- SEARCH
def old_function():
    pass
=======
def new_function():
    return 42
++++++++ REPLACE
```
Requires exact match of SEARCH block. Has fuzzy fallback via difflib.

**`udiff` (unified diff)** — most token-efficient, most fragile:
```diff
--- a/file.py
+++ b/file.py
@@ -10,4 +10,4 @@
 context line
-old line
+new line
 context line
```
Multi-tier repair: direct apply → flexible matching → partial context reduction → whitespace normalization.

**Model size recommendations** (derived from Aider's model settings):
- `< 7B`: `whole` only
- `7B–14B`: `whole` preferred, `diff` if model is instruction-tuned on code
- `14B–34B`: `diff` (search-replace blocks)  
- `34B+`: `udiff` or `diff`
- Reasoning models (DeepSeek R1, QwQ): `diff` — udiff too fragile post-CoT stripping

**Applicability to hanimo**: Must-have. Implement `EditFormat` enum and auto-select based on model size extracted from model name (e.g. `7b`, `14b`, `70b` substrings).

---

### C-2: Whole-File Priority Queue with Ambiguity Resolution (Aider)

**Problem / 문제**: Model outputs a code block but doesn't clearly label which file it's for.

**Source**: `aider/coders/wholefile_coder.py`, `get_edits()` — https://github.com/paul-gauthier/aider/blob/main/aider/coders/wholefile_coder.py

```python
# Fallback filename resolution (reliability-ordered):
# "block": Explicit filename in preceding line
# "saw":   Previously detected filename in surrounding text (backtick-quoted)
# "chat":  Single file in conversation (auto-assumed)
# Error:   Ambiguous — raise ValueError

if fname and fname not in chat_files and Path(fname).name in chat_files:
    fname = Path(fname).name  # strip path prefix model added

# 250-char limit to prevent garbage filename
fname = fname[:250]
```

**Applicability to hanimo**: Should-have. When parsing whole-file output, implement same 3-tier filename resolution.

---

### C-3: SEARCH Block Repair — Diagnostics + Similar Line Suggestions (Aider)

**Problem / 문제**: The model's SEARCH block doesn't match the actual file content (wrong whitespace, slightly different variable name, stale code).

**Source**: `aider/coders/editblock_coder.py`, `apply_edits()` — https://github.com/paul-gauthier/aider/blob/main/aider/coders/editblock_coder.py

**How it works**:
When a SEARCH block fails to match, the system generates diagnostics:
1. Shows the failed SEARCH block
2. Uses difflib to find similar lines in the actual file
3. Reports whether the replacement already exists verbatim
4. Includes this diagnostic in the next user message asking the model to fix its SEARCH block

**Applicability to hanimo**: Should-have. After a failed SEARCH/REPLACE, show the model the closest matching lines from the actual file so it can correct its block.

---

## Category D: Context Budget Adaptation
## D카테고리: 컨텍스트 버짓 적응

### D-1: Per-Model Context Window from Model Card (Aider + Continue.dev)

**Problem / 문제**: Different models have wildly different context windows (4K to 128K+). Sending too many tokens causes silent truncation or OOM errors.

**Sources**:
- Aider `aider/models.py` model info — https://github.com/paul-gauthier/aider/blob/main/aider/models.py
- Continue.dev `core/llm/index.ts`, context length getter — https://github.com/continuedev/continue/blob/main/core/llm/index.ts

**Representative context windows from Aider's model-metadata.json**:
| Model | Max Input | Max Output |
|-------|-----------|-----------|
| DeepSeek Chat v3 | 131,072 | 8,192 |
| DeepSeek Reasoner | 128,000 | 64,000 |
| Gemini 2.5 Pro | 1,048,576 | 65,536 |
| Llama 3.1 70B (typical) | 131,072 | 4,096 |
| Qwen2.5 Coder 32B | 131,072 | 8,192 |

**Aider's token check**:
```python
# base_coder.py, check_tokens() (lines 1533-1550)
input_tokens = self.main_model.token_count(messages)
max_input_tokens = self.main_model.info.get("max_input_tokens") or 0
if max_input_tokens and input_tokens >= max_input_tokens:
    # warn user but allow proceeding
```

**Continue.dev's dynamic context from Ollama**:
```typescript
// Ollama.ts — query /api/show for actual num_ctx
for (const line of body.parameters.split("\n")) {
    if (key === "num_ctx") {
        if (!this.explicitContextLength) {
            this._contextLength = Number.parseInt(value);
        }
    }
}
// Default fallback: 8192
```

**maxTokens calculation** (Continue.dev):
```typescript
maxTokens = Math.min(llmInfo.maxCompletionTokens, this.contextLength / 4)
// Reserves 3/4 of context for input, 1/4 for output
```

**Applicability to hanimo**: Must-have. Query Ollama's `/api/show` on model load to get actual `num_ctx`. Maintain a built-in fallback table for known models.

```go
type ModelCapabilities struct {
    ContextLength   int
    MaxOutputTokens int
    EditFormat      EditFormat
    ChatTemplate    ChatTemplate
    UseTemperature  bool
    ReasoningTag    string
    LazyPrompt      bool
    OvEagerPrompt   bool
}

var KnownModels = map[string]ModelCapabilities{
    "qwen2.5-coder:32b": {131072, 8192, FormatDiff, TemplateChatML, true, "", true, false},
    "deepseek-r1:70b":   {128000, 32768, FormatDiff, TemplateChatML, false, "think", false, false},
    "llama3.1:70b":      {131072, 4096, FormatDiff, TemplateLlama3, true, "", true, false},
    "gemma3:27b":        {131072, 8192, FormatWhole, TemplateGemma, true, "", true, false},
}
```

---

### D-2: Proactive Summarization (Compaction) with Structured Preservation (Cline)

**Problem / 문제**: As conversation grows, context fills up. Naive truncation (drop oldest messages) loses critical task state.

**Source**: `src/core/prompts/contextManagement.ts`, `summarizeTask()` — https://github.com/cline/cline/blob/main/src/core/prompts/contextManagement.ts

**How it works**:  
When context is nearly full, Cline does NOT silently truncate. Instead it forces the model to choose:
1. **Complete now** (`attempt_completion`) — if ready
2. **Summarize** (`summarize_task`) — mandatory if not ready

The summarization captures nine structured sections:
1. Primary requests and user intent
2. Technical concepts and frameworks used
3. **Files and code sections** — full snippets preserved
4. Problem-solving history (what was tried, what failed)
5. Pending tasks
6. Task evolution with verbatim user quotes
7. Current work context
8. Next steps with direct quotes
9. Required files list

Then a `continuationPrompt` reinserts the summary and instructs the model to continue without asking questions.

**Applicability to hanimo**: Should-have for v0.3.0. When token count > 70% of context window, trigger compaction. Use a smaller/faster model for summarization if available.

---

### D-3: `compileChatMessages` — Budget-Aware Message Assembly (Continue.dev)

**Problem / 문제**: System prompt + repo context + tool results + conversation history may exceed context. Need principled truncation.

**Source**: `core/llm/index.ts`, `compileChatMessages()` — https://github.com/continuedev/continue/blob/main/core/llm/index.ts

```typescript
const { compiledChatMessages } = compileChatMessages({
    modelName: completionOptions.model,
    msgs: _messages,
    knownContextLength: this._contextLength,
    maxTokens: completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
    supportsImages: this.supportsImages(),
    tools: optionsWithOverrides.tools,
});
```

Prompt pruning: drop from **top** of message history first (oldest messages), preserving system prompt + recent turns.

```typescript
// index.ts, lines 398
let prompt = pruneRawPromptFromTop(
    completionOptions.model,
    this.contextLength,
    _prompt,
    completionOptions.maxTokens ?? DEFAULT_MAX_TOKENS,
);
```

**Applicability to hanimo**: Must-have. Always prune from oldest messages first. Never truncate the system prompt. Reserve `contextLength/4` for output.

---

### D-4: XS Variant — Compact Prompts for Small Context Windows (Cline)

**Problem / 문제**: A 7B model with 8K context can't fit a 3K-token system prompt. Need a stripped-down system prompt.

**Source**: Cline's `XS` model variant — https://github.com/cline/cline/blob/main/src/core/prompts/system-prompt/README.md

The variant system defines three tiers:
- **Generic**: Full prompt, all tools, all explanations
- **Next-Gen**: Optimized for frontier models (Claude 4, GPT-5, Gemini 2.5)
- **XS**: Compact prompt for limited context windows — fewer tools, shorter descriptions, no examples

**Applicability to hanimo**: Should-have. Implement `PromptTier` in model config: `TierFull | TierCompact | TierMinimal`. Small models (< 14B, context < 16K) get `TierMinimal`.

---

## Category E: Retry / Rate-Limit / Overload Handling
## E카테고리: 재시도 / 레이트 리밋 / 과부하 처리

### E-1: Exponential Backoff Retry Loop (Aider)

**Problem / 문제**: LLM APIs return transient errors (429, 503, "overloaded") that resolve on retry. Hard-failing on first error is too brittle.

**Source**: `aider/coders/base_coder.py`, `send_message()` (lines 1571-1620) — https://github.com/paul-gauthier/aider/blob/main/aider/coders/base_coder.py

```python
retry_delay = 0.125  # start: 125ms
while True:
    try:
        yield from self.send(messages, functions=self.functions)
        break
    except litellm_ex.exceptions_tuple() as err:
        should_retry = ex_info.retry
        if should_retry:
            retry_delay *= 2
            if retry_delay > RETRY_TIMEOUT:  # caps out
                should_retry = False
        if not should_retry:
            raise

# Context window exceeded: no retry (different error path)
except ContextWindowExceededError:
    break  # no retry — need to reduce context
```

**Key design decisions**:
- Initial delay: 125ms (fast first retry)
- Doubles each attempt
- Hard cap at `RETRY_TIMEOUT` (prevent infinite retry)
- `ContextWindowExceededError` is NOT retried — requires different action

**Applicability to hanimo**: Must-have. Already partially in hanimo's `sendchat`; ensure `ContextWindowExceeded` takes a separate code path to trigger compaction, not retry.

---

### E-2: `num_reflections` — Bounded Self-Repair Loop (Aider)

**Problem / 문제**: When the model produces a bad edit, it gets a reflection message showing what went wrong. But if the model keeps failing, we need a hard stop.

**Source**: `aider/coders/base_coder.py`, lines 110-111, 1462-1475 — https://github.com/paul-gauthier/aider/blob/main/aider/coders/base_coder.py

```python
# Initialization
self.num_reflections = 0
self.max_reflections = 3

# Enforcement in run_one()
if self.num_reflections >= self.max_reflections:
    self.io.tool_warning(f"Only {self.max_reflections} reflections allowed, stopping.")
    return
self.num_reflections += 1
```

**Applicability to hanimo**: Must-have. Current hanimo likely has an iteration limit; ensure a separate `reflectionCount` tracks repair attempts distinct from total agent steps.

---

### E-3: Hermes Max Recursion Depth (Hermes-Function-Calling)

**Problem / 문제**: Tool call → repair → tool call loops must terminate.

**Source**: `functioncall.py`, `recursive_loop()` — https://github.com/NousResearch/Hermes-Function-Calling/blob/main/functioncall.py

```python
depth += 1
if depth >= max_depth:  # default: 5
    print(f"Maximum recursion depth reached ({max_depth}). Stopping.")
    return
```

**Applicability to hanimo**: Already implied by existing `maxIterations` in hanimo, but should be **separate** from tool call repair depth (which should be lower, ~3).

---

## Category F: Tool Result Shaping
## F카테고리: 도구 결과 형성

### F-1: Structured Output Truncation (Head + Tail Strategy)

**Problem / 문제**: Shell commands can output megabytes. Sending 500KB of `find` output to a 32K context model wastes all available tokens.

**Source**: Aider's `base_coder.py` run output handling + Cline's tool result design.

**Standard pattern across agents**:
```
[first N lines]
...
[output truncated — X lines omitted]
...
[last M lines]
```

Head provides context (what started executing), tail provides the latest state (errors, completion). Middle is dropped.

**Typical limits seen**:
- Aider: ~500 lines for command output
- Cline: configurable per tool type
- Continue.dev: `pruneRawPromptFromTop` for message-level truncation

**Applicability to hanimo**: Must-have. Current `internal/tools/shell.go` likely has some truncation. Implement explicit `TruncateOutput(output string, maxLines int) string` with head+tail strategy.

```go
func TruncateOutput(output string, maxLines int) string {
    lines := strings.Split(output, "\n")
    if len(lines) <= maxLines {
        return output
    }
    head := maxLines * 2 / 3
    tail := maxLines - head
    omitted := len(lines) - maxLines
    parts := []string{}
    parts = append(parts, strings.Join(lines[:head], "\n"))
    parts = append(parts, fmt.Sprintf("\n... [%d lines omitted] ...\n", omitted))
    parts = append(parts, strings.Join(lines[len(lines)-tail:], "\n"))
    return strings.Join(parts, "")
}
```

---

### F-2: Binary File Refusal

**Problem / 문제**: If the model requests to read a binary file (image, compiled binary, PDF), sending raw bytes wastes tokens and confuses the model.

**Source**: Standard pattern in Cline and Aider. Cline's tool definitions explicitly note file type restrictions.

**Pattern**:
```
Tool result: "[Binary file — cannot display. Size: 2.3MB. Type: application/octet-stream]"
```

**Applicability to hanimo**: Should-have. Add MIME type check in file read tool. Return structured refusal for binary files.

---

### F-3: Large Output → Temp File + Return Path

**Problem / 문제**: Some commands produce output that's useful but too large to include inline. The model can be told where to read it.

**Source**: Common pattern; referenced in Aider's design for large repo maps.

**Pattern**:
```
[Output too large (45,231 tokens). Saved to /tmp/hanimo-output-abc123.txt]
Use the read_file tool to examine specific sections.
```

**Applicability to hanimo**: Nice-to-have. Implement when output > configurable threshold (e.g. 10,000 tokens).

---

### F-4: Tool Result Role Injection (Hermes/ChatML)

**Problem / 문제**: After a tool executes, the result must be injected back into the conversation in a format the model expects. Wrong format causes the model to re-call the tool.

**Source**: Hermes-Function-Calling — https://github.com/NousResearch/Hermes-Function-Calling/blob/main/prompt_assets/sys_prompt.yml

```
<|im_start|>tool
<tool_response>
{"name": "function_name", "content": {result_data}}
</tool_response>
<|im_end|>
```

For Llama 3.1+ with native tool calling:
```
<|start_header_id|>tool<|end_header_id|>
{"result": ...}
<|eot_id|>
```

For models without a `tool` role (fallback):
```
<|im_start|>user
The result of tool_name was: {result}
<|im_end|>
```

**Applicability to hanimo**: Must-have. Tool result injection format must match the model's chat template. Add `ToolResultFormat` to model config.

---

## Category G: Agent Loop Discipline
## G카테고리: 에이전트 루프 규율

### G-1: Max Iterations Hard Stop (Hermes + Aider)

**Problem / 문제**: Without a hard stop, a confused model loops forever calling the same tools.

**Sources**:
- Hermes: `max_depth = 5` in `functioncall.py`
- Aider: `max_reflections = 3` in `base_coder.py`
- Cline: `summarize_task` gate before context overflow

**Recommended values by tier**:
| Model Tier | Max Tool Calls | Max Reflections |
|-----------|---------------|-----------------|
| Small (< 7B) | 10 | 2 |
| Mid (7B–34B) | 20 | 3 |
| Large (34B+) | 50 | 5 |

**Applicability to hanimo**: Already exists as `maxIterations`. Verify it's enforced on the repair sub-loop too.

---

### G-2: Same-Tool-Same-Args Loop Detection

**Problem / 문제**: Model calls `run_shell("ls -la")` three times in a row. No progress. Waste of tokens.

**Source**: Not found as explicit code in studied agents, but is a known failure mode. Cline's `summarize_task` indirectly forces this — it detects "no progress" when context fills without completion.

**Recommended implementation for hanimo**:

```go
type LoopDetector struct {
    recentCalls []ToolCallSignature
    window      int  // check last N calls
}

type ToolCallSignature struct {
    ToolName string
    ArgsHash string  // sha256 of args JSON
}

func (d *LoopDetector) IsLooping(call ToolCallSignature) bool {
    // Check if same (tool, args) appears >= 2 times in window
    count := 0
    for _, past := range d.recentCalls {
        if past == call { count++ }
    }
    return count >= 2
}
```

**Applicability to hanimo**: Must-have. Hash tool name + args, check last 10 calls.

---

### G-3: Forced Binary Choice at Context Limit (Cline Pattern)

**Problem / 문제**: When context is nearly full, models may start hallucinating or producing degraded output instead of acknowledging the limit.

**Source**: `contextManagement.ts`, `summarizeTask()` — https://github.com/cline/cline/blob/main/src/core/prompts/contextManagement.ts

```
"You have only two options:
1. If you are immediately prepared to call the attempt_completion tool, call it now.
2. If you are not prepared, you MUST call the summarize_task tool."
```

This binary choice prevents the model from entering a degraded half-functioning state. It either completes or explicitly preserves state.

**Applicability to hanimo**: Should-have. Add `[CONTEXT_LIMIT_APPROACHING]` state that sends this binary choice prompt.

---

### G-4: Continuation Prompt After Compaction (Cline)

**Problem / 문제**: After summarization, the model must be re-oriented without asking the user to repeat everything.

**Source**: `contextManagement.ts`, `continuationPrompt()` — https://github.com/cline/cline/blob/main/src/core/prompts/contextManagement.ts

```
"Here is the summary of the work done so far:
[SUMMARY]

Please continue the conversation from where we left it off without asking the user any further questions."
```

**Applicability to hanimo**: Must-have if implementing compaction. The continuation prompt is what makes compaction seamless to the user.

---

### G-5: Sequential Tool Calls (No Parallel Overload) — Hermes Design Principle

**Problem / 문제**: Open-weight models asked to call tools in parallel often produce malformed outputs or deadlock waiting for results that don't exist.

**Source**: Hermes `sys_prompt.yml` — https://github.com/NousResearch/Hermes-Function-Calling/blob/main/prompt_assets/sys_prompt.yml

> "Call functions sequentially (avoid parallel calls to prevent overload)"

> "At the very first turn you don't have `<tool_results>` — prohibits fabricated results initially"

**Applicability to hanimo**: Must-have for open models. Force sequential tool execution. Reserve parallel execution only for frontier models with proven parallel tool call support.

---

### G-6: Native Tool Support Detection Per Provider (Continue.dev)

**Problem / 문제**: Not all providers/models support native JSON tool calling. Using it where unsupported causes silent failures.

**Source**: `core/llm/toolSupport.ts` — https://github.com/continuedev/continue/blob/main/core/llm/toolSupport.ts

```typescript
export function modelSupportsNativeTools(modelDescription: ModelDescription) {
    // 1. Check explicit capability override
    if (modelDescription.capabilities?.tools !== undefined) {
        return modelDescription.capabilities.tools;
    }
    // 2. Provider-specific pattern matching
    const providerSupport = PROVIDER_TOOL_SUPPORT[modelDescription.provider];
    if (!providerSupport) return false;
    return providerSupport(modelDescription.model) ?? false;
}

// Models with confirmed native tool support:
// Llama 3.1+, Llama 4, DeepSeek Chat/Coder, Mistral Large/Small/Nemo
// Models WITHOUT confirmed support: Gemma, older Qwen, most <7B models
```

**Applicability to hanimo**: Must-have. Maintain a capability registry with native tool support flag. Default to XML/text tool invocation for unknown models.

---

## Summary Table of All Tactics
## 전술 전체 요약표

| ID | Tactic | Source | Category | Priority |
|----|--------|--------|----------|----------|
| A-1 | XML wrapping + dual JSON parser | Hermes utils.py | Tool Repair | MUST |
| A-2 | Schema-validated repair loop | Hermes functioncall.py | Tool Repair | MUST |
| A-3 | Fuzzy filename matching | Aider editblock_coder.py | Tool Repair | SHOULD |
| A-4 | Model-variant tool specs | Cline execute_command.ts | Tool Repair | NICE |
| A-5 | Accept XML + JSON tool calls | Cline index.ts | Tool Repair | MUST |
| B-1 | Per-family chat template selection | Continue.dev autodetect.ts | Prompt Format | MUST |
| B-2 | use_system_prompt=false | Aider models.py | Prompt Format | SHOULD |
| B-3 | Reminder injection every N turns | Aider base_coder.py | Prompt Format | MUST |
| B-4 | lazy/overeager correction prompts | Aider models.py | Prompt Format | MUST |
| B-5 | examples_as_sys_msg | Aider models.py | Prompt Format | NICE |
| B-6 | use_temperature=false for reasoning | Aider models.py | Prompt Format | MUST |
| B-7 | Strip CoT reasoning tags | Aider models.py | Prompt Format | MUST |
| C-1 | Four edit formats + model-size routing | Aider coders/ | Edit Format | MUST |
| C-2 | Whole-file filename resolution | Aider wholefile_coder.py | Edit Format | SHOULD |
| C-3 | SEARCH block diagnostics | Aider editblock_coder.py | Edit Format | SHOULD |
| D-1 | Per-model context window registry | Aider + Continue.dev | Context Budget | MUST |
| D-2 | Proactive structured compaction | Cline contextManagement.ts | Context Budget | SHOULD |
| D-3 | Prune from top (oldest first) | Continue.dev index.ts | Context Budget | MUST |
| D-4 | XS/compact prompt tier | Cline README.md | Context Budget | SHOULD |
| E-1 | Exponential backoff retry | Aider base_coder.py | Retry/Rate | MUST |
| E-2 | Bounded reflection/repair loop | Aider base_coder.py | Retry/Rate | MUST |
| E-3 | Max recursion depth | Hermes functioncall.py | Retry/Rate | MUST |
| F-1 | Head+tail output truncation | Aider + Cline | Tool Results | MUST |
| F-2 | Binary file refusal | Cline tools | Tool Results | SHOULD |
| F-3 | Large output → temp file | Aider pattern | Tool Results | NICE |
| F-4 | Tool result role injection per template | Hermes sys_prompt.yml | Tool Results | MUST |
| G-1 | Max iterations hard stop | Hermes + Aider | Loop Discipline | MUST |
| G-2 | Same-tool-same-args loop detection | (Pattern synthesis) | Loop Discipline | MUST |
| G-3 | Binary choice at context limit | Cline contextManagement.ts | Loop Discipline | SHOULD |
| G-4 | Continuation prompt after compaction | Cline contextManagement.ts | Loop Discipline | SHOULD |
| G-5 | Sequential tool execution for open models | Hermes sys_prompt.yml | Loop Discipline | MUST |
| G-6 | Native tool support detection | Continue.dev toolSupport.ts | Loop Discipline | MUST |

---

## Recommended Adoption List for hanimo v0.3.0
## hanimo v0.3.0 권장 도입 목록

### MUST-HAVE (즉시 필수 구현)

These are the tactics most likely to cause visible failures if missing. Implement all before calling v0.3.0 complete.

#### 1. Model Capability Registry (`internal/models/registry.go`)

단일 파일에 모든 모델별 설정을 집중화. Centralize all per-model settings.

Fields needed:
```go
type ModelConfig struct {
    Name            string
    ContextLength   int
    MaxOutputTokens int
    EditFormat      EditFormat      // Whole | Diff | UDiff
    ChatTemplate    ChatTemplate    // ChatML | Llama3 | Gemma | DeepSeek | None
    ToolCallMode    ToolCallMode    // Native | XML | Text
    UseTemperature  bool
    ReasoningTag    string          // "think" for DeepSeek R1, QwQ, etc.
    LazyPrompt      bool
    OvereagerPrompt bool
    UseSystemPrompt bool
    ReminderMode    ReminderMode    // Every3Turns | EveryTurn | None
    PromptTier      PromptTier      // Full | Compact | Minimal
}
```

Sources: Aider `models.py`, Continue.dev `autodetect.ts`, `toolSupport.ts`

---

#### 2. Strip Reasoning Tags Before Parsing (`internal/llm/strip.go`)

DeepSeek R1, QwQ, and other reasoning models output thousands of tokens of CoT before the actual answer. Strip before tool call parsing.

Sources: Aider `models.py` (`reasoning_tag`, `remove_reasoning` fields)

---

#### 3. XML Tool Call Parser with Dual JSON Fallback (`internal/tools/parser.go`)

Many open models output `<tool_call>{...}</tool_call>`. Must parse XML, then try `json.Unmarshal`, then lenient parser.

Sources: Hermes `utils.py`, `validate_and_extract_tool_calls()`

---

#### 4. Schema-Validated Repair Loop (`internal/tools/repair.go`)

When tool call is malformed, inject specific error + ask model to fix. Max 3 repair attempts.

Sources: Hermes `functioncall.py`, `validator.py`

---

#### 5. Chat Template Application (`internal/llm/template.go`)

For Ollama `/api/generate` or raw completion endpoints, apply the correct chat template per model family.

Sources: Continue.dev `chat.ts`, `autodetect.ts`

---

#### 6. Lazy/Overeager Correction Prompts (`internal/llm/prompt.go`)

Inject into system prompt for models known to be lazy (most < 14B) or overeager.

Sources: Aider `base_coder.py` `fmt_system_prompt()`

---

#### 7. Reminder Injection Every 3 Turns (`internal/llm/prompt.go`)

Append condensed rules to user message every 3 turns. Critical for small models.

Sources: Aider `base_coder.py` `format_chat_chunks()` (lines 975-1009)

---

#### 8. Head+Tail Output Truncation (`internal/tools/shell.go`)

Truncate command output to max 500 lines using head(2/3) + tail(1/3) strategy.

Sources: Standard pattern across all studied agents

---

#### 9. Tool Result Role Injection (`internal/llm/messages.go`)

Format tool results correctly for each chat template. ChatML uses `<|im_start|>tool`, Llama3 uses `<|start_header_id|>tool`.

Sources: Hermes `sys_prompt.yml`

---

#### 10. Same-Tool-Same-Args Loop Detection (`internal/agents/loop.go`)

Hash (toolName + argsJSON), check last 10 calls, abort if same call seen 2+ times.

---

#### 11. Context Window Prune From Top (`internal/llm/context.go`)

When approaching context limit, drop oldest messages first, always preserving system prompt + last 2 turns.

Sources: Continue.dev `index.ts` `pruneRawPromptFromTop()`

---

#### 12. Sequential Tool Execution Enforcement

For all models except verified-native-parallel models, execute tools one at a time.

Sources: Hermes `sys_prompt.yml` design principle

---

### SHOULD-HAVE (v0.3.0 후반부 또는 v0.3.1)

These significantly improve reliability but the agent works without them (just worse).

- **D-2**: Proactive compaction with structured 9-section summarization (Cline pattern)
- **G-3 + G-4**: Binary choice prompt + continuation prompt after compaction
- **C-2**: Whole-file 3-tier filename resolution
- **C-3**: SEARCH block diagnostic feedback with similar-line suggestions
- **A-3**: Fuzzy filename matching (difflib equivalent in Go)
- **B-2**: `use_system_prompt=false` for O1-style models
- **D-4**: Compact/XS prompt tier for small context models
- **F-2**: Binary file refusal in file read tool

---

### NICE-TO-HAVE (v0.4.0+)

Lower ROI; implement after core harness is solid.

- **B-5**: `examples_as_sys_msg` for models that generalize better from system-level examples
- **A-4**: Model-variant tool specs (different tool definitions per model tier)
- **F-3**: Large output → temp file + return path
- **A-2 extended**: Fuzzy tool name matching (Levenshtein against registered tool names)

---

## Implementation Order for v0.3.0 Sprint
## v0.3.0 스프린트 구현 순서

```
Week 1 — Core Harness Foundation
├── ModelCapability registry (covers B-1, B-6, B-7, C-1, G-6)
├── Reasoning tag stripper (B-7)
└── Chat template engine (B-1)

Week 2 — Tool Call Reliability  
├── XML tool call parser + dual JSON fallback (A-1)
├── Schema-validated repair loop max 3 (A-2, E-2)
└── Tool result role injection (F-4)

Week 3 — Prompt Discipline
├── Lazy/overeager correction prompts (B-4)
├── Reminder injection every 3 turns (B-3)
└── Sequential tool execution flag (G-5)

Week 4 — Context & Loop Safety
├── Context prune from top (D-3)
├── Head+tail output truncation (F-1)
├── Same-tool-same-args loop detector (G-2)
└── Max iterations + max repair depth (G-1, E-3)
```

---

## Source Index
## 출처 목록

| Project | Key Files | URL |
|---------|-----------|-----|
| Aider | `aider/models.py` | https://github.com/paul-gauthier/aider/blob/main/aider/models.py |
| Aider | `aider/coders/base_coder.py` | https://github.com/paul-gauthier/aider/blob/main/aider/coders/base_coder.py |
| Aider | `aider/coders/editblock_coder.py` | https://github.com/paul-gauthier/aider/blob/main/aider/coders/editblock_coder.py |
| Aider | `aider/coders/wholefile_coder.py` | https://github.com/paul-gauthier/aider/blob/main/aider/coders/wholefile_coder.py |
| Aider | `aider/coders/udiff_coder.py` | https://github.com/paul-gauthier/aider/blob/main/aider/coders/udiff_coder.py |
| Cline | `src/core/prompts/system-prompt/tools/execute_command.ts` | https://github.com/cline/cline/blob/main/src/core/prompts/system-prompt/tools/execute_command.ts |
| Cline | `src/core/prompts/system-prompt/tools/replace_in_file.ts` | https://github.com/cline/cline/blob/main/src/core/prompts/system-prompt/tools/replace_in_file.ts |
| Cline | `src/core/prompts/contextManagement.ts` | https://github.com/cline/cline/blob/main/src/core/prompts/contextManagement.ts |
| Cline | `src/core/prompts/system-prompt/README.md` | https://github.com/cline/cline/blob/main/src/core/prompts/system-prompt/README.md |
| Continue.dev | `core/llm/templates/chat.ts` | https://github.com/continuedev/continue/blob/main/core/llm/templates/chat.ts |
| Continue.dev | `core/llm/autodetect.ts` | https://github.com/continuedev/continue/blob/main/core/llm/autodetect.ts |
| Continue.dev | `core/llm/toolSupport.ts` | https://github.com/continuedev/continue/blob/main/core/llm/toolSupport.ts |
| Continue.dev | `core/llm/index.ts` | https://github.com/continuedev/continue/blob/main/core/llm/index.ts |
| Continue.dev | `core/llm/llms/Ollama.ts` | https://github.com/continuedev/continue/blob/main/core/llm/llms/Ollama.ts |
| Hermes-FC | `utils.py` | https://github.com/NousResearch/Hermes-Function-Calling/blob/main/utils.py |
| Hermes-FC | `validator.py` | https://github.com/NousResearch/Hermes-Function-Calling/blob/main/validator.py |
| Hermes-FC | `functioncall.py` | https://github.com/NousResearch/Hermes-Function-Calling/blob/main/functioncall.py |
| Hermes-FC | `prompter.py` | https://github.com/NousResearch/Hermes-Function-Calling/blob/main/prompter.py |
| Hermes-FC | `prompt_assets/sys_prompt.yml` | https://github.com/NousResearch/Hermes-Function-Calling/blob/main/prompt_assets/sys_prompt.yml |
| Hermes-FC | `prompt_assets/few_shot.json` | https://github.com/NousResearch/Hermes-Function-Calling/blob/main/prompt_assets/few_shot.json |
| OpenCode | `packages/opencode/src/session/compaction.ts` | https://github.com/sst/opencode (GitHub API rate-limited during research; structure confirmed via API) |
| OpenCode | `packages/opencode/src/session/retry.ts` | https://github.com/sst/opencode |
| OpenCode | `packages/opencode/src/provider/transform.ts` | https://github.com/sst/opencode |

---

*Document generated by document-specialist agent — 2026-04-11*  
*All source citations verified via GitHub API and WebFetch. OpenCode raw file access was blocked by GitHub API rate limiting; structure was confirmed via tree API.*

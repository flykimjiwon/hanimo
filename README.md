# modol 🐶

> **Terminal AI coding agent — works with any LLM, cloud or local.**

[한국어](README.ko.md) · [GitHub](https://github.com/flykimjiwon/dev_anywhere)

Named after **modol** (모돌), a fluffy white mini bichon dog — small, smart, and always ready to help.

---

## What is modol?

modol is a lightweight, terminal-based AI coding agent. Think Claude Code or Cursor, but **provider-agnostic** and **local-model-first**.

- **14 LLM providers** — OpenAI, Anthropic, Google, DeepSeek, Groq, Ollama, vLLM, LM Studio, and more
- **16 built-in tools** — file editing, shell execution, git, web fetch, diagnostics, and more
- **Hash-anchored editing** — verified edits that prevent stale-line errors
- **Autonomous mode** — agent works until the task is done, no babysitting
- **Smart context compaction** — LLM-based conversation summarization
- **Dual UI** — full TUI (Ink/React) or lightweight text mode
- **Zero native dependencies** — pure JavaScript, `npm install` just works
- **~7,800 lines** — highest feature-to-code density of any AI coding agent

---

## Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- **npm** (comes with Node.js)
- (Optional) **Ollama** for local models — [ollama.com](https://ollama.com)

### Install

```bash
# Clone
git clone https://github.com/flykimjiwon/dev_anywhere.git
cd dev_anywhere

# Install dependencies
npm install
```

### Run

```bash
# Development mode (recommended for first run)
npm run dev

# Or directly
npx tsx src/cli.ts
```

### Global CLI install

```bash
npm link
# Now you can run from anywhere:
modol
```

### First run with Ollama (free, offline)

```bash
# 1. Install Ollama
brew install ollama   # macOS
# or visit https://ollama.com

# 2. Pull a model
ollama pull qwen3:8b

# 3. Start modol
npm run dev -- --provider ollama --model qwen3:8b
```

### First run with OpenAI

```bash
# Set your API key
export OPENAI_API_KEY="sk-..."

# Start modol
npm run dev -- --provider openai --model gpt-4o-mini
```

---

## Supported Providers (14)

| Provider | Type | Models |
|----------|------|--------|
| **OpenAI** | Cloud | gpt-4o, gpt-4o-mini, gpt-4.1, o3-mini |
| **Anthropic** | Cloud | claude-sonnet-4, claude-haiku-4, claude-opus-4 |
| **Google** | Cloud | gemini-2.5-flash, gemini-2.5-pro |
| **DeepSeek** | Cloud | deepseek-chat, deepseek-coder, deepseek-reasoner |
| **Groq** | Cloud | llama-3.3-70b, qwen-qwq-32b |
| **Together** | Cloud | Various open models |
| **OpenRouter** | Cloud | Any model via OpenRouter |
| **Fireworks** | Cloud | Various open models |
| **Mistral** | Cloud | codestral, mistral-large, mistral-small |
| **GLM** | Cloud | Zhipu GLM models |
| **Ollama** | Local | Any Ollama model (qwen3, llama3, gemma3, etc.) |
| **vLLM** | Local | Self-hosted models |
| **LM Studio** | Local | Desktop-managed models |
| **Custom** | Local | Any OpenAI-compatible endpoint |

---

## Tools (16)

modol gives the AI agent 16 built-in tools:

### Core File Operations
| Tool | Description |
|------|-------------|
| `read_file` | Read file contents with line numbers |
| `write_file` | Create/overwrite files (auto-creates directories) |
| `edit_file` | Replace exact string matches in files |
| `hashline_read` | Read with hash-tagged lines for verified editing |
| `hashline_edit` | Edit using hash anchors — prevents stale-line errors |

### Search
| Tool | Description |
|------|-------------|
| `glob_search` | Find files by glob pattern (respects .gitignore) |
| `grep_search` | Regex content search with context lines |
| `batch` | Run multiple reads/globs in parallel (2-5x faster) |

### Shell & Git
| Tool | Description |
|------|-------------|
| `shell_exec` | Execute shell commands (22 dangerous patterns blocked) |
| `git_status` | Check git working tree status |
| `git_diff` | View staged/unstaged changes |
| `git_commit` | Create git commits |
| `git_log` | View commit history |

### New Tools
| Tool | Description |
|------|-------------|
| `webfetch` | Fetch web pages, extract text from HTML/JSON |
| `todo` | Track multi-step work with a task list |
| `diagnostics` | Run TypeScript/ESLint checks without modifying files |

---

## Features

### Hash-Anchored Editing (Hashline)

Traditional line-number editing breaks when the file changes between read and edit. Hashline solves this:

```
# Agent reads file with hashline_read:
1#a3f1| function hello() {
2#7bc2|   console.log("hello");
3#e4d0| }

# Agent edits with hashline_edit using anchors:
startAnchor: "2#7bc2"  endAnchor: "2#7bc2"
newContent: '  console.log("hello world");'

# If line 2 changed since reading → error with "re-read" hint
# If hash matches → edit applied safely
```

### Autonomous Mode (`/auto`)

```
/auto Fix all TypeScript errors in src/
```

The agent loops automatically: reads code → makes changes → runs diagnostics → repeats until done. Max 20 iterations. macOS notification on completion.

### Smart Context Compaction

When conversations get long (40+ messages), modol uses the LLM to summarize earlier context instead of just truncating. This preserves the task goal, completed work, and current state.

### LSP Diagnostics

```
/diagnostics              # Check whole project
/diagnostics src/app.ts   # Check specific file
```

Runs `tsc --noEmit` + ESLint and returns structured results. The agent can read errors and fix them directly.

### Session Management

```
/save                     # Save current session
/load                     # Load a saved session
/sessions                 # List recent sessions
/search auth              # Search sessions by keyword
```

Sessions are stored as JSON files in `~/.modol/sessions/`.

### Role System

Three built-in roles control tool access:

| Role | Tools | Use Case |
|------|-------|----------|
| **dev** (Agent) | All 16 tools | Coding, file editing, git |
| **plan** (Assistant) | Read-only (8 tools) | Code review, analysis |
| **chat** (Chat) | No tools | General conversation |

modol auto-detects the right role based on model capabilities (e.g., small Ollama models get Chat role).

### MCP Support

modol supports Model Context Protocol (MCP) for extending tools:

```json
// ~/.modol/config.json
{
  "mcp": {
    "servers": {
      "my-server": {
        "command": "npx",
        "args": ["-y", "some-mcp-server"],
        "enabled": true
      }
    }
  }
}
```

Supports both **stdio** and **SSE** transports. Servers tagged `onlineOnly` are skipped in offline mode.

---

## Configuration

### Config file: `~/.modol/config.json`

```json
{
  "provider": "ollama",
  "model": "qwen3:8b",
  "providers": {
    "openai": { "apiKey": "sk-..." },
    "anthropic": { "apiKey": "sk-ant-..." }
  },
  "maxSteps": 25,
  "shell": {
    "timeout": 30000,
    "requireApproval": true
  },
  "defaultRole": "dev",
  "subAgents": {
    "enabled": false,
    "count": "3"
  }
}
```

### Project instructions: `.modol.md`

Create a `.modol.md` file in your project root to give the AI context:

```markdown
# Project: My App

- This is a Next.js 15 app with App Router
- Use TypeScript strict mode
- Tests use Vitest
- Database: PostgreSQL with Drizzle ORM
```

modol walks up from CWD to find all `.modol.md` files — great for monorepos with per-package instructions.

### Environment variables

```bash
OPENAI_API_KEY=sk-...          # OpenAI
ANTHROPIC_API_KEY=sk-ant-...   # Anthropic
GOOGLE_API_KEY=AI...           # Google
DEEPSEEK_API_KEY=...           # DeepSeek
GROQ_API_KEY=gsk_...           # Groq
```

---

## Keyboard Shortcuts

### TUI Mode
| Key | Action |
|-----|--------|
| `Esc` | Open main menu |
| `Ctrl+K` | Command palette (fuzzy search) |
| `Ctrl+X` → key | Leader key (S=save, L=load, V=verbose, K=palette) |
| `Ctrl+C` | Cancel current operation (double = exit) |
| `Ctrl+O` | Toggle verbose tool output |
| `Up/Down` | Input history |
| `Tab` | Autocomplete commands |

### Slash Commands
| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model [name]` | Switch model (no arg = menu) |
| `/provider [name]` | Switch provider (no arg = menu) |
| `/role [id]` | Switch role (dev/plan/chat) |
| `/tools [on\|off]` | Toggle tool access |
| `/config` | Show current configuration |
| `/usage` | Token usage & cost estimate |
| `/theme [id]` | Change theme (live preview) |
| `/auto [msg]` | Autonomous mode |
| `/search [keyword]` | Search past sessions |
| `/diagnostics [file]` | Run tsc/eslint checks |
| `/clear` | Clear conversation |
| `/save` | Save session |
| `/load` | Load session |
| `/exit` | Exit modol |

---

## Multi-Agent Orchestration

modol supports multi-agent mode for complex tasks:

```json
// ~/.modol/config.json
{
  "subAgents": {
    "enabled": true,
    "count": "5",
    "model": "gpt-4o-mini"
  }
}
```

The orchestrator decomposes tasks into subtasks, executes them in parallel with sub-agents, and synthesizes results.

---

## Security

modol has layered security:

1. **Path sandboxing** — file ops blocked outside project directory
2. **Sensitive file protection** — `.ssh`, `.aws`, `.env`, `*.key`, `*.pem`, `credentials.*` always blocked
3. **Shell danger filter** — 22+ patterns blocked (rm -rf, sudo, curl|bash, DROP TABLE, fork bombs, etc.)
4. **Permission gate** — destructive operations require user approval

---

## Karpathy Loop (Autonomous Research)

modol includes a `program.md` for running [Karpathy Loop](https://github.com/karpathy/autoresearch) style experiments:

```bash
cd your-project
claude   # or any AI coding agent
# Then: "Read program.md and start the experiment loop"
```

The agent will: read code → make one change → measure score → keep or discard → repeat forever.

---

## Architecture

```
src/
├── core/          # Agent loop, system prompt, compaction, auto-loop
├── tools/         # 16 tools (hashline, webfetch, todo, batch, diagnostics...)
├── providers/     # 14 LLM providers (Ollama, OpenAI, Anthropic, Google...)
├── tui/           # Ink/React fullscreen TUI
├── agents/        # Orchestrator, sub-agents
├── config/        # Zod schema validation
├── roles/         # dev/plan/chat role system
├── session/       # JSON file-based persistence
├── mcp/           # MCP client (stdio + SSE)
├── cli.ts         # Commander CLI entry
└── text-mode.ts   # Lightweight readline mode
```

**~7,800 lines of TypeScript** — 150 tests across 20 test files.

---

## Development

```bash
# Run in dev mode
npm run dev

# Run tests
npm test

# Type check
npm run lint

# Format
npm run format
```

---

## Comparison

| Feature | modol | Claude Code | Cursor | Aider |
|---------|:-----:|:-----------:|:------:|:-----:|
| Open source | Yes | No | No | Yes |
| Local models | 4 providers | No | No | Yes |
| Cloud providers | 10 | 1 | 2 | 5 |
| Built-in tools | 16 | ~10 | ~8 | ~6 |
| Hash editing | Yes | No | No | No |
| Autonomous mode | Yes | No | No | No |
| TUI + Text mode | Both | TUI only | GUI | Text |
| Zero native deps | Yes | No | No | No |
| Code size | 7.8K | ~200K+ | N/A | ~15K |

---

## Roadmap

- [ ] Plugin system for third-party tools
- [ ] VS Code extension
- [ ] Web UI dashboard
- [ ] modol.app ecosystem integration (ModolAI, ModolRAG)
- [ ] Agent swarm mode (multiple agents collaborating)

---

## License

MIT

---

<p align="center">
  Built with love by <a href="https://github.com/flykimjiwon">김지원</a> and modol 🐶
</p>

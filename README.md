# devany

> **Terminal AI coding assistant that works with any LLM — cloud or local**

[한국어](README.ko.md)

---

## What is devany?

devany is a terminal-based AI coding assistant similar to Claude Code, Cursor, or Aider. It connects to **14 LLM providers** (cloud APIs + local servers) and lets AI read, write, search, and execute code in your project — all from the terminal.

Key differentiators:
- **14 providers, one interface** — OpenAI, Anthropic, Google, DeepSeek, Groq, Ollama, and 8 more
- **Ollama-first** — optimized for local models, zero API cost, full offline support
- **Smart role detection** — automatically assigns Agent/Assistant/Chat role based on model capabilities
- **Zero native deps** — pure JavaScript, `npm install` just works (no C++ builds)

---

## Quick Start

```bash
# Clone & install
git clone https://github.com/flykimjiwon/dev_anywhere.git
cd dev_anywhere
npm install

# Run (first launch opens setup wizard)
npm run dev

# Or with specific provider/model
npm run dev -- -p ollama -m qwen3:8b
npm run dev -- -p openai -m gpt-4o
```

**Requirements**: Node.js >= 20.0.0

---

## Installation

```bash
# Development mode (tsx, hot reload)
npm run dev

# Build & run
npm run build
npm start

# Global install (use `devany` anywhere)
npm link
devany
```

---

## Usage

```bash
# Text mode (default — readline-based interactive)
devany

# TUI mode (fullscreen Ink-based)
devany --tui

# With initial prompt
devany "explain the project structure"

# Specify provider & model
devany -p ollama -m qwen3:8b
devany -p anthropic -m claude-sonnet-4-20250514
devany -p deepseek -m deepseek-chat

# Custom endpoint (any OpenAI-compatible server)
devany -u http://my-server:8000/v1 -m my-model

# Session management
devany --list-sessions          # List saved sessions
devany --resume                 # Resume latest session
devany --resume abc12345        # Resume specific session

# Re-run setup
devany --setup
```

---

## Supported Providers (14)

### Cloud APIs

| Provider | Default Model | Models | Auth |
|----------|--------------|--------|------|
| **OpenAI** | gpt-4o-mini | 7 | API key |
| **Anthropic** | claude-sonnet-4 | 3 | API key |
| **Google** | gemini-2.5-flash | 3 | API key |
| **DeepSeek** | deepseek-chat | 3 | API key |
| **Groq** | qwen-qwq-32b | 4 | API key |
| **Together** | Qwen2.5-Coder-32B | 4 | API key |
| **OpenRouter** | deepseek-chat-v3 (free) | 4 | API key |
| **Fireworks** | qwen2p5-coder-32b | 3 | API key |
| **Mistral** | codestral-latest | 3 | API key |
| **GLM/Zhipu** | glm-4-plus | 3 | API key |

### Local / Self-hosted

| Provider | Default URL | Auth |
|----------|-----------|------|
| **Ollama** | localhost:11434 | None |
| **vLLM** | localhost:8000 | None |
| **LM Studio** | localhost:1234 | None |
| **Custom** | (user-specified) | Optional |

---

## AI Tools (9)

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Create or overwrite files |
| `edit_file` | Edit specific lines in a file |
| `glob_search` | Find files by pattern (.gitignore aware) |
| `grep_search` | Search file contents with regex (.gitignore aware) |
| `shell_exec` | Execute shell commands (22 dangerous patterns blocked) |
| `git_status` | Check git status |
| `git_diff` | View git changes |
| `git_commit` | Create git commits |

---

## Smart Model Role Detection

devany automatically detects model capabilities and assigns roles:

| Role | Badge | Tools Available | Example Models |
|------|-------|----------------|----------------|
| **Agent** | `[A]` green | All 9 tools | qwen3:8b+, all cloud APIs |
| **Assistant** | `[R]` yellow | Read-only (3) | qwen3.5:4b, mistral:7b |
| **Chat** | `[C]` gray | None | gemma3:1b, codegemma |

30+ models registered with 4-tier matching: exact name → prefix → cloud provider → safe default.

---

## Slash Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `/help` | `/h` | Show help |
| `/model [name]` | `/m` | Switch model (no arg = menu) |
| `/provider [name]` | `/p` | Switch provider |
| `/tools [on\|off]` | `/t` | Toggle tools |
| `/models` | | List models with role badges |
| `/endpoint url` | `/e` | Connect custom endpoint |
| `/lang [ko\|en\|ja\|zh]` | | Set response language |
| `/config` | | Show current config |
| `/usage` | `/u` | Token usage & cost |
| `/clear` | | Clear conversation |
| `/exit` | `/q` | Exit |

**Keyboard**: `Esc` = menu, `Tab` = autocomplete, `Ctrl+C` = cancel/exit

---

## Security

- **Path sandboxing** — file operations blocked outside CWD + sensitive paths (.ssh, .aws, .env)
- **Shell filter** — 22 dangerous patterns blocked (rm -rf, sudo, curl|bash, eval, DROP TABLE, etc.)
- **Config protection** — `~/.dev-anywhere/config.json` saved with `0600` permissions
- **.gitignore** — glob/grep searches respect .gitignore automatically

---

## Project Instructions

Create a `.devany.md` file in your project root to give AI project-specific context:

```markdown
# My Project
- This is a Next.js 15 app with TypeScript strict
- Use Tailwind CSS for styling
- API routes are in app/api/
- Never use `any` type
```

This is automatically injected into the system prompt on every session.

---

## Architecture

```
dev_anywhere/
├── src/
│   ├── cli.ts                    # CLI entrypoint (commander)
│   ├── text-mode.ts              # Text mode (readline-based)
│   ├── onboarding.ts             # First-run setup wizard
│   ├── core/
│   │   ├── agent-loop.ts         # LLM agent loop (Vercel AI SDK streamText)
│   │   ├── system-prompt.ts      # System prompt builder (.devany.md loader)
│   │   ├── permission.ts         # Path sandboxing + permission gate
│   │   ├── markdown.ts           # ANSI terminal markdown renderer
│   │   └── types.ts              # Shared types (Message, AgentEvent)
│   ├── providers/
│   │   ├── registry.ts           # Provider factory + cache
│   │   ├── types.ts              # 14 providers + KNOWN_MODELS
│   │   └── model-capabilities.ts # 30+ model capability registry
│   ├── tools/
│   │   ├── registry.ts           # Tool registry (full + read-only)
│   │   ├── file-ops.ts           # read/write/edit (sandboxed)
│   │   ├── shell-exec.ts         # Shell exec (danger filter)
│   │   ├── grep-search.ts        # Regex content search
│   │   ├── glob-search.ts        # File pattern search
│   │   └── git-tools.ts          # Git operations
│   ├── session/
│   │   └── store.ts              # JSON file-based session storage
│   ├── tui/
│   │   ├── app.tsx               # TUI main app (Ink + React)
│   │   ├── components/           # ChatView, InputBar, StatusBar, SelectMenu
│   │   └── hooks/                # useAgent, useCommands, useStream
│   └── config/
│       ├── loader.ts             # Config loader (env → file → defaults)
│       └── schema.ts             # Config schema
├── tests/                        # 5 test files, 43 tests
├── vitest.config.ts
├── eslint.config.js
├── .prettierrc
└── tsconfig.json
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js >= 20 |
| **Language** | TypeScript (strict, ES2022, NodeNext) |
| **LLM Integration** | Vercel AI SDK v4 (streamText, tool calling) |
| **Provider SDKs** | @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google |
| **TUI** | Ink 5 + React 18 |
| **CLI** | Commander |
| **Validation** | Zod |
| **Shell** | Execa |
| **File Search** | Globby (gitignore support) |
| **Git** | simple-git |
| **Testing** | Vitest (43 tests) |
| **Linting** | ESLint + typescript-eslint |
| **Formatting** | Prettier |

**Zero native dependencies** — no C++ builds, no Python, no Rust. Pure JavaScript.

---

## Data Storage

| Path | Contents |
|------|----------|
| `~/.dev-anywhere/config.json` | Provider, model, API keys (0600 perms) |
| `~/.dev-anywhere/sessions/*.json` | Conversation sessions (auto-saved) |
| `.devany.md` (project root) | Project-specific AI instructions |

---

## Development

```bash
npm run dev            # Run with tsx
npm run build          # TypeScript build
npm test               # Run 43 tests
npm run test:watch     # Watch mode
npm run lint           # tsc --noEmit + eslint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Prettier format
npm run format:check   # Check formatting
```

---

## Research Documents

The initial research that informed this project:

| # | Document | Contents |
|---|----------|----------|
| 1 | [Tools Survey](docs/01-tools-survey.md) | 35+ terminal AI coding tools survey |
| 2 | [Feasibility](docs/02-feasibility.md) | Architecture, language choice, timeline |
| 3 | [License Analysis](docs/03-license-analysis.md) | Fork legality for 20 tools |
| 4 | [Deployment](docs/04-deployment.md) | Cloud vs air-gap deployment scenarios |

---

## License

MIT

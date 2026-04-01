# hanimo VS Code Extension - Implementation Plan

**Created:** 2026-03-27
**Status:** Draft - Awaiting Confirmation
**Complexity:** HIGH (monorepo restructure + extension + webview + publishing pipeline)

---

## Table of Contents

1. [Architecture Decision](#1-architecture-decision)
2. [Phase 1: Terminal Integration (Day 1)](#2-phase-1-terminal-integration-day-1)
3. [Phase 2: Sidebar Chat (Week 1)](#3-phase-2-sidebar-chat-week-1)
4. [Phase 3: Advanced Features (Week 2-3)](#4-phase-3-advanced-features-week-2-3)
5. [Phase 4: Marketplace Publishing](#5-phase-4-marketplace-publishing)
6. [Phase 5: Open VSX Publishing](#6-phase-5-open-vsx-publishing)
7. [Marketing & Growth](#7-marketing--growth)
8. [Revenue Model](#8-revenue-model)

---

## 1. Architecture Decision

### Decision: Monorepo with `@hanimo/core` Package Extraction

**Why monorepo, not separate repo:**
- hanimo is pre-1.0 and rapidly changing. Separate repos create version drift nightmares.
- A single `pnpm workspace` lets the extension import `@hanimo/core` without publishing to npm.
- Single CI pipeline, single PR for cross-cutting changes.

**Why not "just import from CLI":**
- The CLI pulls in `commander`, `ink`, `react` (for TUI), `readline` -- none of which belong in a VS Code extension host.
- The extension host is a long-running Node.js process. It needs the agent loop, tools, and providers, but NOT the TUI/CLI layer.

### Monorepo Structure

```
hanimo/                              # Root (was dev_anywhere/)
  pnpm-workspace.yaml
  package.json                      # Root workspace scripts
  tsconfig.base.json                # Shared compiler options

  packages/
    core/                           # @hanimo/core - headless engine
      package.json
      tsconfig.json
      src/
        index.ts                    # Re-exports (current src/index.ts, expanded)
        agent-loop.ts               # FROM src/core/agent-loop.ts
        compaction.ts               # FROM src/core/compaction.ts
        auto-loop.ts                # FROM src/core/auto-loop.ts
        system-prompt.ts            # FROM src/core/system-prompt.ts
        instructions.ts             # FROM src/core/instructions.ts
        markdown.ts                 # FROM src/core/markdown.ts
        permission.ts               # FROM src/core/permission.ts
        permission-gate.ts          # FROM src/core/permission-gate.ts
        types.ts                    # FROM src/core/types.ts
        config/
          schema.ts                 # FROM src/config/schema.ts
          defaults.ts               # FROM src/config/defaults.ts
          loader.ts                 # FROM src/config/loader.ts
        providers/
          registry.ts               # FROM src/providers/registry.ts
          types.ts                   # FROM src/providers/types.ts
          model-capabilities.ts      # FROM src/providers/model-capabilities.ts
          model-discovery.ts         # FROM src/providers/model-discovery.ts
          endpoint-manager.ts        # FROM src/providers/endpoint-manager.ts
        tools/
          registry.ts               # FROM src/tools/registry.ts
          file-ops.ts               # FROM src/tools/file-ops.ts
          git-tools.ts              # FROM src/tools/git-tools.ts
          shell-exec.ts             # FROM src/tools/shell-exec.ts
          glob-search.ts            # FROM src/tools/glob-search.ts
          grep-search.ts            # FROM src/tools/grep-search.ts
          hashline-edit.ts          # FROM src/tools/hashline-edit.ts
          webfetch.ts               # FROM src/tools/webfetch.ts
          todo.ts                   # FROM src/tools/todo.ts
          batch.ts                  # FROM src/tools/batch.ts
          lsp-diagnostics.ts        # FROM src/tools/lsp-diagnostics.ts
          notify.ts                 # FROM src/tools/notify.ts
        session/
          store.ts                  # FROM src/session/store.ts
          types.ts                  # FROM src/session/types.ts
        roles/
          role-manager.ts           # FROM src/roles/role-manager.ts
          types.ts                  # FROM src/roles/types.ts
          built-in/                 # FROM src/roles/built-in/
        agents/
          orchestrator.ts           # FROM src/agents/orchestrator.ts
          sub-agent.ts              # FROM src/agents/sub-agent.ts
          types.ts                  # FROM src/agents/types.ts
          file-lock.ts              # FROM src/agents/file-lock.ts
        mcp/
          bridge.ts                 # FROM src/mcp/bridge.ts
          client.ts                 # FROM src/mcp/client.ts
          network.ts                # FROM src/mcp/network.ts

    cli/                            # @hanimo/cli - terminal interface
      package.json                  # depends on @hanimo/core
      tsconfig.json
      bin/
        hanimo                       # FROM bin/hanimo
      src/
        cli.ts                      # FROM src/cli.ts (imports from @hanimo/core)
        text-mode.ts                # FROM src/text-mode.ts
        onboarding.ts               # FROM src/onboarding.ts
        tui/                        # FROM src/tui/ (entire directory)
          app.tsx
          theme.ts
          themes.ts
          components/
          hooks/

    vscode/                         # @hanimo/vscode - VS Code extension
      package.json                  # VS Code extension manifest
      tsconfig.json
      src/
        extension.ts                # Activation entry point
        hanimo-service.ts            # Wraps @hanimo/core for extension host
        terminal-panel.ts           # Phase 1: embedded terminal
        sidebar-provider.ts         # Phase 2: webview sidebar
        inline-provider.ts          # Phase 3: inline completions
        code-actions.ts             # Phase 3: code actions
        diagnostics.ts              # Phase 3: diagnostics bridge
        diff-provider.ts            # Phase 3: file diff preview
        status-bar.ts               # Status bar item
        constants.ts                # Command IDs, config keys
      webview/                      # Phase 2: React webview app
        src/
          App.tsx
          index.tsx
          components/
          hooks/
          styles/
        package.json
        vite.config.ts
      resources/
        icon.png                    # 128x128 extension icon
        dark/                       # Dark theme icons
        light/                      # Light theme icons
      .vscodeignore
      esbuild.js                    # Bundle extension host code
```

### Module Classification

| Module | Goes to `@hanimo/core` | Why |
|--------|----------------------|-----|
| `agent-loop.ts` | Yes | Headless, no UI dependency |
| `types.ts` | Yes | Shared types |
| `system-prompt.ts` | Yes | Used by all frontends |
| `providers/*` | Yes | Model registry is UI-agnostic |
| `tools/*` | Yes | Tool implementations are headless |
| `config/*` | Yes | Config loading is shared |
| `session/*` | Yes | Session persistence is shared |
| `roles/*` | Yes | Role system is headless |
| `mcp/*` | Yes | MCP bridge is headless |
| `agents/*` | Yes | Orchestration is headless |
| `permission.ts` | Yes | Logic is headless |
| `permission-gate.ts` | Yes | PermissionHandler interface is headless; UI provides the impl |
| `cli.ts` | CLI only | Commander setup, TUI bootstrap |
| `text-mode.ts` | CLI only | Readline-based UI |
| `onboarding.ts` | CLI only | Terminal-specific prompts |
| `tui/*` | CLI only | Ink/React terminal UI |

### Key Design Principle: PermissionHandler Injection

The `permission-gate.ts` already uses a `PermissionHandler` interface:

```typescript
export interface PermissionHandler {
  requestApproval(description: string): Promise<boolean>;
}
```

This is the critical abstraction. The CLI provides a terminal-based approval prompt. The VS Code extension will provide:

```typescript
// In vscode extension:
const vscodePermissionHandler: PermissionHandler = {
  async requestApproval(description: string): Promise<boolean> {
    const choice = await vscode.window.showWarningMessage(
      `modol wants to: ${description}`,
      { modal: true },
      'Allow', 'Deny'
    );
    return choice === 'Allow';
  }
};
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

### Root package.json

```json
{
  "name": "modol-workspace",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "build:core": "pnpm --filter @modol/core build",
    "build:cli": "pnpm --filter @modol/cli build",
    "build:vscode": "pnpm --filter @modol/vscode build",
    "dev": "pnpm --filter @modol/cli dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "clean": "pnpm -r exec rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.5.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### packages/core/package.json

```json
{
  "name": "@modol/core",
  "version": "0.1.0",
  "description": "modol headless AI coding engine",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./tools": {
      "import": "./dist/tools/registry.js",
      "types": "./dist/tools/registry.d.ts"
    },
    "./providers": {
      "import": "./dist/providers/registry.js",
      "types": "./dist/providers/registry.d.ts"
    },
    "./config": {
      "import": "./dist/config/loader.js",
      "types": "./dist/config/loader.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/google": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.28.0",
    "ai": "^4.0.0",
    "execa": "^9.0.0",
    "globby": "^14.0.0",
    "simple-git": "^3.24.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

### packages/cli/package.json

```json
{
  "name": "@modol/cli",
  "version": "0.1.0",
  "description": "modol terminal-based AI coding assistant",
  "type": "module",
  "bin": {
    "modol": "./bin/modol"
  },
  "main": "./dist/cli.js",
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "start": "node dist/cli.js"
  },
  "dependencies": {
    "@modol/core": "workspace:*",
    "commander": "^12.0.0",
    "ink": "^5.0.0",
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
```

---

## 2. Phase 1: Terminal Integration (Day 1)

### Goal
Embed modol as a terminal panel inside VS Code. Users type in the terminal, modol responds. This is the fastest path to a working extension.

### packages/vscode/package.json (Extension Manifest)

```json
{
  "name": "modol",
  "displayName": "modol - AI Coding Agent",
  "description": "Terminal-based AI coding assistant with 14 LLM providers, Ollama-first design",
  "version": "0.1.0",
  "publisher": "modol",
  "license": "MIT",
  "icon": "resources/icon.png",
  "repository": {
    "type": "git",
    "url": "https://github.com/modolai/modol"
  },
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "AI",
    "Programming Languages",
    "Chat"
  ],
  "keywords": [
    "ai",
    "coding-assistant",
    "ollama",
    "local-llm",
    "copilot",
    "chat",
    "agent",
    "code-generation",
    "modol"
  ],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "modol.openTerminal",
        "title": "modol: Open Terminal",
        "icon": {
          "light": "resources/light/terminal.svg",
          "dark": "resources/dark/terminal.svg"
        }
      },
      {
        "command": "modol.openChat",
        "title": "modol: Open Chat Sidebar"
      },
      {
        "command": "modol.askAboutSelection",
        "title": "modol: Ask About Selection"
      },
      {
        "command": "modol.explainCode",
        "title": "modol: Explain This Code"
      },
      {
        "command": "modol.fixCode",
        "title": "modol: Fix This Code"
      },
      {
        "command": "modol.refactorCode",
        "title": "modol: Refactor This Code"
      },
      {
        "command": "modol.generateTests",
        "title": "modol: Generate Tests"
      },
      {
        "command": "modol.addDocumentation",
        "title": "modol: Add Documentation"
      },
      {
        "command": "modol.sendToModol",
        "title": "modol: Send Prompt"
      },
      {
        "command": "modol.stopGeneration",
        "title": "modol: Stop Generation",
        "icon": "$(debug-stop)"
      },
      {
        "command": "modol.clearChat",
        "title": "modol: Clear Chat"
      },
      {
        "command": "modol.selectProvider",
        "title": "modol: Select Provider"
      },
      {
        "command": "modol.selectModel",
        "title": "modol: Select Model"
      },
      {
        "command": "modol.showSettings",
        "title": "modol: Settings"
      }
    ],
    "keybindings": [
      {
        "command": "modol.openTerminal",
        "key": "ctrl+shift+m",
        "mac": "cmd+shift+m"
      },
      {
        "command": "modol.openChat",
        "key": "ctrl+shift+l",
        "mac": "cmd+shift+l"
      },
      {
        "command": "modol.askAboutSelection",
        "key": "ctrl+shift+a",
        "mac": "cmd+shift+a",
        "when": "editorHasSelection"
      },
      {
        "command": "modol.sendToModol",
        "key": "ctrl+enter",
        "mac": "cmd+enter",
        "when": "modol.chatFocused"
      },
      {
        "command": "modol.stopGeneration",
        "key": "escape",
        "when": "modol.isGenerating"
      }
    ],
    "menus": {
      "editor/context": [
        {
          "submenu": "modol.editorContext",
          "group": "modol@1"
        }
      ],
      "modol.editorContext": [
        {
          "command": "modol.askAboutSelection",
          "when": "editorHasSelection"
        },
        {
          "command": "modol.explainCode",
          "when": "editorHasSelection"
        },
        {
          "command": "modol.fixCode",
          "when": "editorHasSelection"
        },
        {
          "command": "modol.refactorCode",
          "when": "editorHasSelection"
        },
        {
          "command": "modol.generateTests",
          "when": "editorHasSelection"
        },
        {
          "command": "modol.addDocumentation",
          "when": "editorHasSelection"
        }
      ],
      "explorer/context": [
        {
          "command": "modol.askAboutSelection",
          "group": "modol@1"
        }
      ]
    },
    "submenus": [
      {
        "id": "modol.editorContext",
        "label": "modol"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "modol-sidebar",
          "title": "modol",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "modol-sidebar": [
        {
          "type": "webview",
          "id": "modol.chatView",
          "name": "Chat"
        }
      ]
    },
    "configuration": {
      "title": "modol",
      "properties": {
        "modol.provider": {
          "type": "string",
          "default": "ollama",
          "enum": [
            "openai", "anthropic", "google", "deepseek", "groq",
            "together", "openrouter", "fireworks", "mistral", "glm",
            "ollama", "vllm", "lmstudio", "custom"
          ],
          "description": "Default LLM provider"
        },
        "modol.model": {
          "type": "string",
          "default": "",
          "description": "Model name (leave empty for provider default)"
        },
        "modol.apiKey": {
          "type": "string",
          "default": "",
          "description": "API key (for cloud providers)"
        },
        "modol.baseUrl": {
          "type": "string",
          "default": "",
          "description": "Custom base URL (for self-hosted endpoints)"
        },
        "modol.ollamaUrl": {
          "type": "string",
          "default": "http://localhost:11434",
          "description": "Ollama server URL"
        },
        "modol.maxSteps": {
          "type": "number",
          "default": 25,
          "minimum": 1,
          "maximum": 100,
          "description": "Maximum agent loop steps per request"
        },
        "modol.shell.requireApproval": {
          "type": "boolean",
          "default": true,
          "description": "Require approval before destructive operations (write, edit, shell, git commit)"
        },
        "modol.theme": {
          "type": "string",
          "default": "auto",
          "enum": ["auto", "dark", "light"],
          "description": "Chat theme (auto follows VS Code theme)"
        },
        "modol.terminal.defaultMode": {
          "type": "string",
          "default": "text",
          "enum": ["text", "tui"],
          "description": "Default terminal mode when opening modol terminal"
        }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "pnpm run build",
    "build": "node esbuild.js --production && pnpm run build:webview",
    "build:webview": "cd webview && pnpm run build",
    "watch": "node esbuild.js --watch",
    "dev": "pnpm run watch",
    "package": "vsce package --no-dependencies",
    "publish": "vsce publish --no-dependencies",
    "publish:ovsx": "ovsx publish --no-dependencies"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@vscode/vsce": "^3.0.0",
    "esbuild": "^0.21.0",
    "ovsx": "^0.9.0",
    "typescript": "^5.5.0"
  },
  "dependencies": {
    "@modol/core": "workspace:*"
  }
}
```

### packages/vscode/src/constants.ts

```typescript
export const EXTENSION_ID = 'modol.modol';

export const COMMANDS = {
  OPEN_TERMINAL: 'modol.openTerminal',
  OPEN_CHAT: 'modol.openChat',
  ASK_ABOUT_SELECTION: 'modol.askAboutSelection',
  EXPLAIN_CODE: 'modol.explainCode',
  FIX_CODE: 'modol.fixCode',
  REFACTOR_CODE: 'modol.refactorCode',
  GENERATE_TESTS: 'modol.generateTests',
  ADD_DOCUMENTATION: 'modol.addDocumentation',
  SEND_TO_MODOL: 'modol.sendToModol',
  STOP_GENERATION: 'modol.stopGeneration',
  CLEAR_CHAT: 'modol.clearChat',
  SELECT_PROVIDER: 'modol.selectProvider',
  SELECT_MODEL: 'modol.selectModel',
  SHOW_SETTINGS: 'modol.showSettings',
} as const;

export const CONTEXT_KEYS = {
  CHAT_FOCUSED: 'modol.chatFocused',
  IS_GENERATING: 'modol.isGenerating',
  HAS_ACTIVE_SESSION: 'modol.hasActiveSession',
} as const;

export const CONFIG_KEYS = {
  PROVIDER: 'modol.provider',
  MODEL: 'modol.model',
  API_KEY: 'modol.apiKey',
  BASE_URL: 'modol.baseUrl',
  OLLAMA_URL: 'modol.ollamaUrl',
  MAX_STEPS: 'modol.maxSteps',
  REQUIRE_APPROVAL: 'modol.shell.requireApproval',
  THEME: 'modol.theme',
  TERMINAL_MODE: 'modol.terminal.defaultMode',
} as const;
```

### packages/vscode/src/extension.ts (Phase 1 - Terminal)

```typescript
import * as vscode from 'vscode';
import { COMMANDS, CONTEXT_KEYS, CONFIG_KEYS } from './constants.js';
import { ModolService } from './modol-service.js';
import { ModolSidebarProvider } from './sidebar-provider.js';
import { ModolStatusBar } from './status-bar.js';

let modolService: ModolService | undefined;
let statusBar: ModolStatusBar | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Initialize the headless modol service
  modolService = new ModolService(context);
  statusBar = new ModolStatusBar();

  // Phase 1: Terminal command
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.OPEN_TERMINAL, () => {
      openModolTerminal(context);
    })
  );

  // Phase 2: Sidebar webview
  const sidebarProvider = new ModolSidebarProvider(
    context.extensionUri,
    modolService
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'modol.chatView',
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.OPEN_CHAT, () => {
      vscode.commands.executeCommand('modol.chatView.focus');
    })
  );

  // Editor context commands
  const selectionCommands = [
    { id: COMMANDS.ASK_ABOUT_SELECTION, prompt: '' },
    { id: COMMANDS.EXPLAIN_CODE, prompt: 'Explain this code:\n\n' },
    { id: COMMANDS.FIX_CODE, prompt: 'Fix this code:\n\n' },
    { id: COMMANDS.REFACTOR_CODE, prompt: 'Refactor this code:\n\n' },
    { id: COMMANDS.GENERATE_TESTS, prompt: 'Generate tests for this code:\n\n' },
    { id: COMMANDS.ADD_DOCUMENTATION, prompt: 'Add documentation to this code:\n\n' },
  ];

  for (const { id, prompt } of selectionCommands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText && id !== COMMANDS.ASK_ABOUT_SELECTION) return;

        const filePath = editor.document.uri.fsPath;
        const lang = editor.document.languageId;

        let userPrompt = prompt;
        if (id === COMMANDS.ASK_ABOUT_SELECTION) {
          const input = await vscode.window.showInputBox({
            prompt: 'Ask modol about the selected code',
            placeHolder: 'What does this do?',
          });
          if (!input) return;
          userPrompt = input + '\n\n';
        }

        const fullPrompt = `${userPrompt}\`\`\`${lang}\n// ${filePath}\n${selectedText}\n\`\`\``;

        // Focus sidebar and send
        await vscode.commands.executeCommand('modol.chatView.focus');
        sidebarProvider.sendMessage(fullPrompt);
      })
    );
  }

  // Provider/model selection
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.SELECT_PROVIDER, async () => {
      const providers = [
        'ollama', 'openai', 'anthropic', 'google', 'deepseek',
        'groq', 'together', 'openrouter', 'fireworks', 'mistral',
        'glm', 'vllm', 'lmstudio', 'custom'
      ];
      const pick = await vscode.window.showQuickPick(providers, {
        placeHolder: 'Select LLM provider',
      });
      if (pick) {
        await vscode.workspace.getConfiguration().update(
          CONFIG_KEYS.PROVIDER, pick, vscode.ConfigurationTarget.Global
        );
        modolService?.updateConfig();
        statusBar?.update(pick, vscode.workspace.getConfiguration().get(CONFIG_KEYS.MODEL) || '');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.SELECT_MODEL, async () => {
      const model = await vscode.window.showInputBox({
        prompt: 'Enter model name',
        placeHolder: 'e.g., qwen3:8b, gpt-4o-mini, claude-sonnet-4-20250514',
        value: vscode.workspace.getConfiguration().get(CONFIG_KEYS.MODEL) || '',
      });
      if (model !== undefined) {
        await vscode.workspace.getConfiguration().update(
          CONFIG_KEYS.MODEL, model, vscode.ConfigurationTarget.Global
        );
        modolService?.updateConfig();
        statusBar?.update(
          vscode.workspace.getConfiguration().get(CONFIG_KEYS.PROVIDER) || 'ollama',
          model
        );
      }
    })
  );

  // Stop generation
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.STOP_GENERATION, () => {
      modolService?.abort();
      vscode.commands.executeCommand('setContext', CONTEXT_KEYS.IS_GENERATING, false);
    })
  );

  // Clear chat
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.CLEAR_CHAT, () => {
      modolService?.clearSession();
      sidebarProvider.clearChat();
    })
  );

  // Settings
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.SHOW_SETTINGS, () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:modol.modol'
      );
    })
  );

  // Status bar
  const provider = vscode.workspace.getConfiguration().get<string>(CONFIG_KEYS.PROVIDER) || 'ollama';
  const model = vscode.workspace.getConfiguration().get<string>(CONFIG_KEYS.MODEL) || '';
  statusBar.update(provider, model);
  context.subscriptions.push(statusBar);

  // Watch config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('modol')) {
        modolService?.updateConfig();
        const p = vscode.workspace.getConfiguration().get<string>(CONFIG_KEYS.PROVIDER) || 'ollama';
        const m = vscode.workspace.getConfiguration().get<string>(CONFIG_KEYS.MODEL) || '';
        statusBar?.update(p, m);
      }
    })
  );
}

function openModolTerminal(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration();
  const mode = config.get<string>(CONFIG_KEYS.TERMINAL_MODE) || 'text';
  const provider = config.get<string>(CONFIG_KEYS.PROVIDER) || 'ollama';
  const model = config.get<string>(CONFIG_KEYS.MODEL) || '';

  // Find the modol binary
  // Priority: workspace node_modules -> global install -> npx
  const args = ['--' + mode];
  if (provider) args.push('--provider', provider);
  if (model) args.push('--model', model);

  const terminal = vscode.window.createTerminal({
    name: `modol (${provider}/${model || 'default'})`,
    shellPath: 'npx',
    shellArgs: ['modol', ...args],
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    iconPath: new vscode.ThemeIcon('hubot'),
  });
  terminal.show();
}

export function deactivate(): void {
  modolService?.dispose();
  statusBar?.dispose();
}
```

### packages/vscode/src/modol-service.ts

```typescript
import * as vscode from 'vscode';
import type { LanguageModelV1, ToolSet } from 'ai';
import type { AgentEvent, AgentLoopResult, Message } from '@modol/core';
import { runAgentLoop, buildSystemPrompt, getModel, createToolRegistry } from '@modol/core';
import { wrapToolsWithPermission } from '@modol/core';
import type { PermissionHandler } from '@modol/core';
import type { ProviderName } from '@modol/core';
import { CONFIG_KEYS, CONTEXT_KEYS } from './constants.js';

export class ModolService {
  private context: vscode.ExtensionContext;
  private messages: Message[] = [];
  private abortController: AbortController | null = null;
  private model: LanguageModelV1 | null = null;
  private tools: ToolSet | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.updateConfig();
  }

  updateConfig(): void {
    const config = vscode.workspace.getConfiguration();
    const provider = (config.get<string>(CONFIG_KEYS.PROVIDER) || 'ollama') as ProviderName;
    const modelName = config.get<string>(CONFIG_KEYS.MODEL) || '';
    const apiKey = config.get<string>(CONFIG_KEYS.API_KEY) || undefined;
    const baseUrl = config.get<string>(CONFIG_KEYS.BASE_URL) || undefined;
    const requireApproval = config.get<boolean>(CONFIG_KEYS.REQUIRE_APPROVAL) ?? true;

    try {
      this.model = getModel(provider, modelName, { apiKey, baseURL: baseUrl });
    } catch (err) {
      vscode.window.showErrorMessage(
        `modol: Failed to initialize ${provider}/${modelName}: ${err}`
      );
      return;
    }

    const rawTools = createToolRegistry();
    const permissionHandler: PermissionHandler = {
      async requestApproval(description: string): Promise<boolean> {
        const choice = await vscode.window.showWarningMessage(
          `modol wants to: ${description}`,
          { modal: true },
          'Allow',
          'Deny'
        );
        return choice === 'Allow';
      },
    };
    this.tools = wrapToolsWithPermission(rawTools, requireApproval, permissionHandler);
  }

  async sendMessage(
    content: string,
    onEvent?: (event: AgentEvent) => void
  ): Promise<AgentLoopResult | null> {
    if (!this.model || !this.tools) {
      vscode.window.showErrorMessage('modol: No model configured. Run "modol: Settings".');
      return null;
    }

    this.abortController = new AbortController();
    vscode.commands.executeCommand('setContext', CONTEXT_KEYS.IS_GENERATING, true);

    this.messages.push({ role: 'user', content });

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const systemPrompt = buildSystemPrompt({ cwd, platform: process.platform });

    const maxSteps = vscode.workspace.getConfiguration().get<number>(CONFIG_KEYS.MAX_STEPS) || 25;

    try {
      const result = await runAgentLoop({
        model: this.model,
        systemPrompt,
        messages: this.messages,
        tools: this.tools,
        maxSteps,
        onEvent,
        abortSignal: this.abortController.signal,
      });

      this.messages = result.messages;
      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (error.name !== 'AbortError') {
        vscode.window.showErrorMessage(`modol error: ${error.message}`);
      }
      return null;
    } finally {
      this.abortController = null;
      vscode.commands.executeCommand('setContext', CONTEXT_KEYS.IS_GENERATING, false);
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  clearSession(): void {
    this.messages = [];
  }

  dispose(): void {
    this.abort();
  }
}
```

### packages/vscode/src/status-bar.ts

```typescript
import * as vscode from 'vscode';
import { COMMANDS } from './constants.js';

export class ModolStatusBar implements vscode.Disposable {
  private item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = COMMANDS.SELECT_MODEL;
    this.item.tooltip = 'Click to change modol model';
    this.item.show();
  }

  update(provider: string, model: string): void {
    const display = model || 'default';
    this.item.text = `$(hubot) ${provider}/${display}`;
  }

  setLoading(loading: boolean): void {
    if (loading) {
      this.item.text = `$(loading~spin) modol thinking...`;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
```

### packages/vscode/esbuild.js

```javascript
const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'info',
    // @modol/core is bundled in (not external)
    // vscode is the only external
  });

  if (watch) {
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

### packages/vscode/.vscodeignore

```
.vscode/**
src/**
webview/src/**
webview/node_modules/**
node_modules/**
!dist/**
!webview/dist/**
!resources/**
tsconfig.json
esbuild.js
*.map
```

### How to Test Locally (Phase 1)

```bash
# 1. Build the monorepo
cd modol/
pnpm install
pnpm build

# 2. Open extension in VS Code dev host
cd packages/vscode
code --extensionDevelopmentPath=.

# 3. In the Extension Development Host window:
#    - Cmd+Shift+P -> "modol: Open Terminal"
#    - Cmd+Shift+P -> "modol: Open Chat Sidebar"
#    - Select text in editor, right-click -> modol submenu

# 4. Alternative: package and install
pnpm run package
# This creates modol-0.1.0.vsix
code --install-extension modol-0.1.0.vsix
```

---

## 3. Phase 2: Sidebar Chat (Week 1)

### Webview Architecture

The VS Code sidebar uses a **Webview** -- essentially an iframe running a separate web app. Communication is via `postMessage`.

```
+---------------------------+        postMessage        +---------------------------+
|   Extension Host (Node)   | <-----------------------> |   Webview (Browser)       |
|                           |                           |                           |
|   ModolService            |   { type, payload }       |   React App               |
|   - runAgentLoop()        | ----------------------->  |   - ChatView              |
|   - tools execution       |                           |   - InputBar              |
|   - file system access    | <-----------------------  |   - MarkdownRenderer      |
|                           |   { type, payload }       |   - ToolCallDisplay       |
+---------------------------+                           +---------------------------+
```

### Message Protocol (extension host <-> webview)

```typescript
// packages/vscode/src/webview-protocol.ts

// Extension Host -> Webview
export type ExtensionToWebview =
  | { type: 'token'; content: string }
  | { type: 'tool-call'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolName: string; result: string; isError: boolean }
  | { type: 'done'; response: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: 'error'; message: string }
  | { type: 'clear' }
  | { type: 'config-changed'; provider: string; model: string }
  | { type: 'theme'; kind: 'dark' | 'light'; cssVariables: Record<string, string> };

// Webview -> Extension Host
export type WebviewToExtension =
  | { type: 'send-message'; content: string }
  | { type: 'stop-generation' }
  | { type: 'clear-chat' }
  | { type: 'select-provider' }
  | { type: 'select-model' }
  | { type: 'apply-code'; code: string; filePath?: string }
  | { type: 'copy-code'; code: string }
  | { type: 'ready' };
```

### packages/vscode/src/sidebar-provider.ts

```typescript
import * as vscode from 'vscode';
import { ModolService } from './modol-service.js';
import type { ExtensionToWebview, WebviewToExtension } from './webview-protocol.js';

export class ModolSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private pendingMessages: string[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly modolService: ModolService
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'resources'),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtension) => {
        switch (message.type) {
          case 'ready':
            // Send any pending messages
            for (const msg of this.pendingMessages) {
              this.handleSendMessage(msg);
            }
            this.pendingMessages = [];
            // Send theme
            this.sendThemeToWebview();
            break;

          case 'send-message':
            await this.handleSendMessage(message.content);
            break;

          case 'stop-generation':
            this.modolService.abort();
            break;

          case 'clear-chat':
            this.modolService.clearSession();
            break;

          case 'select-provider':
            vscode.commands.executeCommand('modol.selectProvider');
            break;

          case 'select-model':
            vscode.commands.executeCommand('modol.selectModel');
            break;

          case 'apply-code':
            await this.applyCodeToEditor(message.code, message.filePath);
            break;

          case 'copy-code':
            await vscode.env.clipboard.writeText(message.code);
            vscode.window.showInformationMessage('Code copied to clipboard');
            break;
        }
      }
    );

    // Watch for theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      this.sendThemeToWebview();
    });
  }

  private async handleSendMessage(content: string): Promise<void> {
    await this.modolService.sendMessage(content, (event) => {
      // Forward agent events to webview
      this.postMessage(event as ExtensionToWebview);
    });
  }

  sendMessage(content: string): void {
    if (this.view) {
      this.postMessage({ type: 'send-message', content } as unknown as ExtensionToWebview);
      this.handleSendMessage(content);
    } else {
      this.pendingMessages.push(content);
    }
  }

  clearChat(): void {
    this.postMessage({ type: 'clear' });
  }

  private postMessage(message: ExtensionToWebview): void {
    this.view?.webview.postMessage(message);
  }

  private sendThemeToWebview(): void {
    const kind = vscode.window.activeColorTheme.kind;
    const isDark = kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
    this.postMessage({
      type: 'theme',
      kind: isDark ? 'dark' : 'light',
      cssVariables: {}, // VS Code CSS variables are auto-available in webview
    });
  }

  private async applyCodeToEditor(code: string, filePath?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor to apply code to');
      return;
    }

    if (filePath) {
      // Open the specific file first
      const doc = await vscode.workspace.openTextDocument(filePath);
      const targetEditor = await vscode.window.showTextDocument(doc);
      await targetEditor.edit((editBuilder) => {
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length)
        );
        editBuilder.replace(fullRange, code);
      });
    } else if (editor.selection.isEmpty) {
      // Insert at cursor
      await editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, code);
      });
    } else {
      // Replace selection
      await editor.edit((editBuilder) => {
        editBuilder.replace(editor.selection, code);
      });
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist', 'index.css')
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}';
                 font-src ${webview.cspSource};
                 img-src ${webview.cspSource} https: data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>modol Chat</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
```

### Webview React App

#### packages/vscode/webview/package.json

```json
{
  "name": "@modol/vscode-webview",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "rehype-highlight": "^7.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite": "^5.0.0",
    "typescript": "^5.5.0"
  }
}
```

#### packages/vscode/webview/vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index.[ext]',
      },
    },
    // Single chunk for webview
    cssCodeSplit: false,
  },
});
```

#### packages/vscode/webview/src/App.tsx

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, MessageRole } from './components/ChatMessage';
import { InputArea } from './components/InputArea';
import { ToolCallDisplay } from './components/ToolCallDisplay';
import { Header } from './components/Header';
import type { ExtensionToWebview, WebviewToExtension } from '../../src/webview-protocol';
import './styles/index.css';

// VS Code API bridge
declare function acquireVsCodeApi(): {
  postMessage(message: WebviewToExtension): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

interface ChatEntry {
  id: string;
  role: MessageRole;
  content: string;
  toolCalls?: Array<{ toolName: string; args: Record<string, unknown> }>;
  toolResults?: Array<{ toolName: string; result: string; isError: boolean }>;
  usage?: { promptTokens: number; completionTokens: number };
  isStreaming?: boolean;
}

export function App(): React.ReactElement {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for messages from extension host
  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToWebview>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'token': {
          if (!streamingIdRef.current) {
            const id = Date.now().toString();
            streamingIdRef.current = id;
            setMessages((prev) => [
              ...prev,
              { id, role: 'assistant', content: msg.content, isStreaming: true },
            ]);
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingIdRef.current
                  ? { ...m, content: m.content + msg.content }
                  : m
              )
            );
          }
          setIsGenerating(true);
          break;
        }

        case 'tool-call': {
          const id = streamingIdRef.current || Date.now().toString();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    toolCalls: [
                      ...(m.toolCalls || []),
                      { toolName: msg.toolName, args: msg.args },
                    ],
                  }
                : m
            )
          );
          break;
        }

        case 'tool-result': {
          const id = streamingIdRef.current || Date.now().toString();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    toolResults: [
                      ...(m.toolResults || []),
                      { toolName: msg.toolName, result: msg.result, isError: msg.isError },
                    ],
                  }
                : m
            )
          );
          break;
        }

        case 'done': {
          const id = streamingIdRef.current;
          if (id) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id
                  ? { ...m, content: msg.response, isStreaming: false, usage: msg.usage }
                  : m
              )
            );
          }
          streamingIdRef.current = null;
          setIsGenerating(false);
          break;
        }

        case 'error': {
          streamingIdRef.current = null;
          setIsGenerating(false);
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), role: 'error', content: msg.message },
          ]);
          break;
        }

        case 'clear':
          setMessages([]);
          streamingIdRef.current = null;
          setIsGenerating(false);
          break;

        case 'theme':
          setTheme(msg.kind);
          break;
      }
    };

    window.addEventListener('message', handler);
    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      if (!content.trim() || isGenerating) return;

      const userMsg: ChatEntry = {
        id: Date.now().toString(),
        role: 'user',
        content,
      };
      setMessages((prev) => [...prev, userMsg]);
      vscode.postMessage({ type: 'send-message', content });
    },
    [isGenerating]
  );

  const handleStop = useCallback(() => {
    vscode.postMessage({ type: 'stop-generation' });
  }, []);

  const handleApplyCode = useCallback((code: string, filePath?: string) => {
    vscode.postMessage({ type: 'apply-code', code, filePath });
  }, []);

  const handleCopyCode = useCallback((code: string) => {
    vscode.postMessage({ type: 'copy-code', code });
  }, []);

  return (
    <div className={`app ${theme}`}>
      <Header
        onClear={() => vscode.postMessage({ type: 'clear-chat' })}
        onSelectProvider={() => vscode.postMessage({ type: 'select-provider' })}
        onSelectModel={() => vscode.postMessage({ type: 'select-model' })}
      />
      <div className="chat-container">
        {messages.map((msg) => (
          <div key={msg.id} className="message-group">
            <ChatMessage
              role={msg.role}
              content={msg.content}
              isStreaming={msg.isStreaming}
              usage={msg.usage}
              onApplyCode={handleApplyCode}
              onCopyCode={handleCopyCode}
            />
            {msg.toolCalls?.map((tc, i) => (
              <ToolCallDisplay
                key={`tc-${msg.id}-${i}`}
                toolName={tc.toolName}
                args={tc.args}
                result={msg.toolResults?.[i]}
              />
            ))}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <InputArea
        onSend={handleSend}
        onStop={handleStop}
        isGenerating={isGenerating}
      />
    </div>
  );
}
```

### Webview Component List

| Component | File | Description |
|-----------|------|-------------|
| `App` | `App.tsx` | Root, manages state + message protocol |
| `Header` | `components/Header.tsx` | Provider/model display, clear/settings buttons |
| `ChatMessage` | `components/ChatMessage.tsx` | Single message bubble with markdown rendering |
| `InputArea` | `components/InputArea.tsx` | Text input with send/stop buttons, Shift+Enter for newline |
| `ToolCallDisplay` | `components/ToolCallDisplay.tsx` | Collapsible tool call/result display |
| `CodeBlock` | `components/CodeBlock.tsx` | Syntax-highlighted code with copy/apply buttons |
| `MarkdownRenderer` | `components/MarkdownRenderer.tsx` | react-markdown wrapper with code block handling |
| `Spinner` | `components/Spinner.tsx` | Loading indicator |

### Theme Support (auto-detect)

The webview automatically inherits VS Code CSS variables. The webview CSS should use:

```css
/* packages/vscode/webview/src/styles/index.css */

:root {
  /* Map VS Code variables to modol semantic tokens */
  --modol-bg: var(--vscode-editor-background);
  --modol-fg: var(--vscode-editor-foreground);
  --modol-input-bg: var(--vscode-input-background);
  --modol-input-fg: var(--vscode-input-foreground);
  --modol-input-border: var(--vscode-input-border);
  --modol-button-bg: var(--vscode-button-background);
  --modol-button-fg: var(--vscode-button-foreground);
  --modol-button-hover: var(--vscode-button-hoverBackground);
  --modol-user-bg: var(--vscode-textBlockQuote-background);
  --modol-assistant-bg: var(--vscode-editor-background);
  --modol-error: var(--vscode-errorForeground);
  --modol-link: var(--vscode-textLink-foreground);
  --modol-code-bg: var(--vscode-textCodeBlock-background);
  --modol-border: var(--vscode-panel-border);
  --modol-badge-bg: var(--vscode-badge-background);
  --modol-badge-fg: var(--vscode-badge-foreground);
}

body {
  background: var(--modol-bg);
  color: var(--modol-fg);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
}

/* This approach means dark/light theming is automatic --
   no explicit theme switching needed */
```

---

## 4. Phase 3: Advanced Features (Week 2-3)

### 4.1 Inline Completions

```typescript
// packages/vscode/src/inline-provider.ts
import * as vscode from 'vscode';
import { ModolService } from './modol-service.js';

export class ModolInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  constructor(private modolService: ModolService) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[]> {
    // Only trigger on explicit invocation or after typing
    if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
      // Debounce: wait 500ms of no typing
      await new Promise((r) => setTimeout(r, 500));
      if (token.isCancellationRequested) return [];
    }

    const prefix = document.getText(
      new vscode.Range(new vscode.Position(0, 0), position)
    );
    const suffix = document.getText(
      new vscode.Range(position, document.positionAt(document.getText().length))
    );

    const prompt = `Complete the code at the cursor position. Return ONLY the completion text, no explanation.

File: ${document.fileName}
Language: ${document.languageId}

Code before cursor:
\`\`\`
${prefix.slice(-2000)}
\`\`\`

Code after cursor:
\`\`\`
${suffix.slice(0, 500)}
\`\`\`

Complete from the cursor position:`;

    let completion = '';
    const result = await this.modolService.sendMessage(prompt, (event) => {
      if (event.type === 'token') completion += event.content;
    });

    if (!result || !completion.trim()) return [];

    // Clean up: remove markdown fences if LLM wraps output
    let clean = completion.trim();
    if (clean.startsWith('```')) {
      const lines = clean.split('\n');
      lines.shift(); // remove opening fence
      if (lines[lines.length - 1]?.startsWith('```')) lines.pop();
      clean = lines.join('\n');
    }

    return [
      new vscode.InlineCompletionItem(
        clean,
        new vscode.Range(position, position)
      ),
    ];
  }
}

// Registration in extension.ts:
// vscode.languages.registerInlineCompletionItemProvider(
//   { pattern: '**' },
//   new ModolInlineCompletionProvider(modolService)
// );
```

### 4.2 Code Actions / Quick Fixes

```typescript
// packages/vscode/src/code-actions.ts
import * as vscode from 'vscode';

export class ModolCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
    vscode.CodeActionKind.Refactor,
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // If there are diagnostics on this range, offer "Fix with modol"
    if (context.diagnostics.length > 0) {
      const fixAction = new vscode.CodeAction(
        'Fix with modol',
        vscode.CodeActionKind.QuickFix
      );
      fixAction.command = {
        command: 'modol.fixCode',
        title: 'Fix with modol',
      };
      fixAction.diagnostics = context.diagnostics;
      fixAction.isPreferred = false; // Don't auto-apply
      actions.push(fixAction);
    }

    // Always offer refactor if there's a selection
    if (!range.isEmpty) {
      const explainAction = new vscode.CodeAction(
        'Explain with modol',
        vscode.CodeActionKind.Empty
      );
      explainAction.command = {
        command: 'modol.explainCode',
        title: 'Explain with modol',
      };
      actions.push(explainAction);

      const refactorAction = new vscode.CodeAction(
        'Refactor with modol',
        vscode.CodeActionKind.Refactor
      );
      refactorAction.command = {
        command: 'modol.refactorCode',
        title: 'Refactor with modol',
      };
      actions.push(refactorAction);
    }

    return actions;
  }
}

// Registration in extension.ts:
// vscode.languages.registerCodeActionsProvider(
//   { scheme: 'file' },
//   new ModolCodeActionProvider(),
//   { providedCodeActionKinds: ModolCodeActionProvider.providedCodeActionKinds }
// );
```

### 4.3 Diagnostics Integration

```typescript
// packages/vscode/src/diagnostics.ts
import * as vscode from 'vscode';

// Bridge: forward modol's lsp-diagnostics tool results into VS Code's Problems panel
export class ModolDiagnosticsManager {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('modol');
  }

  /**
   * Set diagnostics from modol tool results.
   * Called when the agent runs the `diagnostics` tool.
   */
  setDiagnostics(
    filePath: string,
    items: Array<{
      line: number;
      column: number;
      message: string;
      severity: 'error' | 'warning' | 'info' | 'hint';
      source?: string;
    }>
  ): void {
    const uri = vscode.Uri.file(filePath);
    const diagnostics = items.map((item) => {
      const range = new vscode.Range(
        item.line - 1,
        item.column - 1,
        item.line - 1,
        item.column + 20
      );
      const severity =
        item.severity === 'error'
          ? vscode.DiagnosticSeverity.Error
          : item.severity === 'warning'
            ? vscode.DiagnosticSeverity.Warning
            : item.severity === 'hint'
              ? vscode.DiagnosticSeverity.Hint
              : vscode.DiagnosticSeverity.Information;

      const diag = new vscode.Diagnostic(range, item.message, severity);
      diag.source = item.source || 'modol';
      return diag;
    });

    this.collection.set(uri, diagnostics);
  }

  clear(): void {
    this.collection.clear();
  }

  dispose(): void {
    this.collection.dispose();
  }
}
```

### 4.4 File Diff Preview

```typescript
// packages/vscode/src/diff-provider.ts
import * as vscode from 'vscode';

/**
 * Show a diff preview before modol applies changes to a file.
 * Uses VS Code's built-in diff editor.
 */
export async function showDiffPreview(
  filePath: string,
  originalContent: string,
  modifiedContent: string
): Promise<boolean> {
  const originalUri = vscode.Uri.parse(
    `modol-original:${filePath}?${encodeURIComponent(originalContent)}`
  );
  const modifiedUri = vscode.Uri.parse(
    `modol-modified:${filePath}?${encodeURIComponent(modifiedContent)}`
  );

  // Register content providers
  const originalProvider = new (class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(): string {
      return originalContent;
    }
  })();
  const modifiedProvider = new (class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(): string {
      return modifiedContent;
    }
  })();

  const sub1 = vscode.workspace.registerTextDocumentContentProvider('modol-original', originalProvider);
  const sub2 = vscode.workspace.registerTextDocumentContentProvider('modol-modified', modifiedProvider);

  await vscode.commands.executeCommand(
    'vscode.diff',
    originalUri,
    modifiedUri,
    `modol: ${filePath} (preview)`,
    { preview: true }
  );

  const choice = await vscode.window.showInformationMessage(
    'Apply these changes?',
    'Apply',
    'Discard'
  );

  sub1.dispose();
  sub2.dispose();

  return choice === 'Apply';
}
```

### 4.5 Status Bar Integration (Enhanced)

The status bar (from Phase 1) gains additional states:

```
Idle:      $(hubot) ollama/qwen3:8b
Thinking:  $(loading~spin) modol thinking...
Error:     $(error) modol: connection failed
Tool:      $(tools) modol: running shell_exec...
Cost:      $(hubot) ollama/qwen3:8b | $0.003
```

---

## 5. Phase 4: Marketplace Publishing

### Step-by-Step Setup

#### 5.1 Azure DevOps Organization & Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Click "New organization" (or use existing)
3. Organization name: `modolai`
4. Go to User Settings (top right) -> Personal access tokens
5. Click "New Token"
   - Name: `vscode-marketplace`
   - Organization: `modolai`
   - Expiration: Custom (set to 1 year)
   - Scopes: Click "Show all scopes" -> Marketplace -> check **Manage**
6. Click "Create" and **save the token immediately** (shown only once)

#### 5.2 Create Publisher

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Create publisher (interactive)
vsce create-publisher modol
# Enter: publisher name = modol
# Enter: PAT from step 5.1

# Or login to existing publisher
vsce login modol
# Enter PAT
```

#### 5.3 Icon & Branding Requirements

| Asset | Size | Format | Notes |
|-------|------|--------|-------|
| Extension icon | 128x128 px | PNG | Required. Square, no transparency issues |
| Marketplace banner | 1024x200 px | PNG | Optional, for gallery header |
| Activity bar icon | 24x24 px | SVG | Monochrome, used in sidebar |
| Light/dark icons | 16x16 px | SVG | For tree view items |

Place the icon at `packages/vscode/resources/icon.png`.

The `package.json` icon field: `"icon": "resources/icon.png"`

Recommended design: A cute robot/animal mascot (fitting the "modol" brand). Simple, recognizable at 128px. Avoid text in the icon.

#### 5.4 Extension README (Marketplace Display)

The file at `packages/vscode/README.md` is what shows on the Marketplace page.

Structure:
```markdown
# modol - AI Coding Agent for VS Code

> Terminal-based AI coding assistant with 14 LLM providers. Ollama-first. Free & open-source.

![Demo GIF](./resources/demo.gif)

## Features

- **Chat Sidebar** - Ask questions, get code, apply changes directly to your editor
- **14 LLM Providers** - Ollama, OpenAI, Anthropic, Google, DeepSeek, Groq, Mistral...
- **Ollama-First** - Works completely offline with local models
- **16 Built-in Tools** - File ops, git, shell, grep, web fetch, diagnostics...
- **Code Actions** - Right-click any code for explain/fix/refactor/test
- **Inline Completions** - AI-powered autocomplete from any model
- **Terminal Mode** - Full TUI experience inside VS Code terminal

## Quick Start

1. Install the extension
2. Have Ollama running (`ollama serve`)
3. Press `Cmd+Shift+L` to open chat
4. Start coding with AI

## Provider Setup

### Local (no API key needed)
- **Ollama**: `ollama serve` (default: http://localhost:11434)
- **LM Studio**: Start server on port 1234
- **vLLM**: Start server on port 8000

### Cloud (API key required)
Set your key in Settings > modol > API Key, or use environment variables:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, etc.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+L` | Open Chat Sidebar |
| `Cmd+Shift+M` | Open Terminal |
| `Cmd+Shift+A` | Ask About Selection |
| `Cmd+Enter` | Send Message (in chat) |
| `Escape` | Stop Generation |

## Settings

All settings under `modol.*` in VS Code Settings.

## Requirements

- Node.js >= 20
- For local models: Ollama, LM Studio, or vLLM
- For cloud models: API key for your chosen provider
```

#### 5.5 Marketplace Metadata

In `package.json`:

```json
{
  "categories": ["AI", "Programming Languages", "Chat"],
  "keywords": [
    "ai", "coding-assistant", "ollama", "local-llm", "copilot",
    "chat", "agent", "code-generation", "modol",
    "anthropic", "openai", "deepseek", "groq", "open-source"
  ],
  "galleryBanner": {
    "color": "#1E1E2E",
    "theme": "dark"
  },
  "badges": [
    {
      "url": "https://img.shields.io/github/stars/modolai/modol?style=social",
      "href": "https://github.com/modolai/modol",
      "description": "GitHub Stars"
    },
    {
      "url": "https://img.shields.io/github/license/modolai/modol",
      "href": "https://github.com/modolai/modol/blob/main/LICENSE",
      "description": "License"
    }
  ]
}
```

#### 5.6 Version Strategy

Follow semver:
- `0.1.0` - Initial release (terminal + sidebar chat)
- `0.2.0` - Inline completions, code actions
- `0.3.0` - Diagnostics, diff preview
- `1.0.0` - Stable release after community feedback

Increment strategy:
- Patch (0.1.x): Bug fixes, minor polish
- Minor (0.x.0): New features
- Major (x.0.0): Breaking changes to settings/API

#### 5.7 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/vscode-extension.yml
name: VS Code Extension CI

on:
  push:
    branches: [main]
    paths:
      - 'packages/vscode/**'
      - 'packages/core/**'
  pull_request:
    branches: [main]
    paths:
      - 'packages/vscode/**'
      - 'packages/core/**'
  release:
    types: [published]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test

      - name: Package VSIX
        working-directory: packages/vscode
        run: pnpm run package

      - name: Upload VSIX
        uses: actions/upload-artifact@v4
        with:
          name: modol-vsix
          path: packages/vscode/*.vsix

  publish:
    needs: build
    runs-on: ubuntu-latest
    if: github.event_name == 'release'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      # Publish to VS Code Marketplace
      - name: Publish to Marketplace
        working-directory: packages/vscode
        run: pnpm run publish
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}

      # Publish to Open VSX
      - name: Publish to Open VSX
        working-directory: packages/vscode
        run: pnpm run publish:ovsx
        env:
          OVSX_PAT: ${{ secrets.OVSX_PAT }}
```

### Publishing Commands

```bash
# One-time setup
npm install -g @vscode/vsce ovsx

# Package
cd packages/vscode
pnpm run package
# -> modol-0.1.0.vsix

# Publish to VS Code Marketplace
vsce publish
# Or with explicit PAT:
vsce publish -p <PAT>

# Publish pre-release
vsce publish --pre-release
```

---

## 6. Phase 5: Open VSX Publishing

Open VSX is the open-source marketplace used by VS Codium, Gitpod, Eclipse Theia.

### Setup

1. Go to https://open-vsx.org
2. Sign in with GitHub
3. Go to Settings -> Access Tokens -> Generate Token
4. Name: `modol-publish`, save the token

### Dual Publishing Workflow

```bash
# Install ovsx CLI
npm install -g ovsx

# Publish to Open VSX
cd packages/vscode
ovsx publish modol-0.1.0.vsix -p <OVSX_TOKEN>

# Or from source:
ovsx publish -p <OVSX_TOKEN>
```

The CI/CD pipeline in Section 5.7 already handles both marketplaces. Store:
- `VSCE_PAT` as GitHub secret (for VS Code Marketplace)
- `OVSX_PAT` as GitHub secret (for Open VSX)

---

## 7. Marketing & Growth

### 7.1 Marketplace SEO

**Title optimization:**
- Display name: `modol - AI Coding Agent` (includes primary keyword)
- Description (first 200 chars matter most): "Terminal-based AI coding assistant with 14 LLM providers, Ollama-first design. Works offline with local models. Free & open-source."

**Keywords** (up to 15): ai, coding-assistant, ollama, local-llm, copilot, chat, agent, code-generation, anthropic, openai, deepseek, groq, open-source, autocomplete, refactor

**Categories**: AI, Programming Languages, Chat (max 3)

### 7.2 GitHub README Badges

```markdown
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/modol.modol?label=VS%20Code&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=modol.modol)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/modol.modol)](https://marketplace.visualstudio.com/items?itemName=modol.modol)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/modol.modol)](https://marketplace.visualstudio.com/items?itemName=modol.modol)
[![Open VSX](https://img.shields.io/open-vsx/v/modol/modol?label=Open%20VSX)](https://open-vsx.org/extension/modol/modol)
[![License](https://img.shields.io/github/license/modolai/modol)](LICENSE)
```

### 7.3 Social Media Strategy

**Launch announcement channels:**
- Reddit: r/vscode, r/LocalLLaMA, r/ollama, r/programming
- Hacker News: "Show HN: modol - Ollama-first AI coding agent for VS Code"
- Twitter/X: Thread format with GIF demo
- Discord: Ollama Discord, VS Code community, AI dev communities

**Key messaging angles:**
1. **Ollama-first**: "Unlike Copilot, modol works completely offline with your local models"
2. **14 providers**: "Bring your own model from any provider"
3. **Free/open-source**: "No subscription, no telemetry"
4. **Agent, not autocomplete**: "16 tools - modol reads, writes, searches, runs commands"

### 7.4 Competitor Comparison Table

| Feature | modol | GitHub Copilot | Continue.dev | Cody | Aider |
|---------|-------|---------------|-------------|------|-------|
| Local models (Ollama) | Yes (primary) | No | Yes | No | Yes |
| Cloud providers | 14 | 1 (OpenAI) | 5+ | 1 | 3 |
| Terminal agent | Yes | No | No | No | Yes |
| VS Code extension | Yes | Yes | Yes | Yes | No |
| Built-in tools | 16 | Limited | Few | Few | CLI |
| MCP support | Yes | No | No | No | No |
| Price | Free | $10/mo | Free | Free/$9 | Free |
| Open source | Yes | No | Yes | Yes | Yes |

### 7.5 Target User Personas

1. **Privacy-conscious developer**: Uses Ollama, wants offline AI. Key message: "Your code never leaves your machine."
2. **Cost-conscious developer**: Tired of Copilot subscription. Key message: "Free forever, use your own models."
3. **Power user**: Wants agent capabilities, not just autocomplete. Key message: "16 tools, full codebase access."
4. **Enterprise developer**: Needs self-hosted LLM support. Key message: "Point to any OpenAI-compatible endpoint."

---

## 8. Revenue Model

### Recommendation: Stay Free, Monetize via Services

Given modol's positioning as an Ollama-first, open-source tool, aggressive monetization would undermine trust.

### Free Tier (everything)
- All 14 providers
- All 16 tools
- Terminal + VS Code extension
- Unlimited local model usage
- MCP support
- Session history

### Optional Pro Tier (if pursued later)
Possible premium features that don't gate core functionality:

| Feature | Rationale |
|---------|-----------|
| Cloud session sync | Sync sessions across devices (requires server) |
| Team sharing | Share configs, sessions, custom roles across team |
| Priority support | Dedicated support channel |
| Custom model fine-tuning pipeline | Guided model training on user's codebase |
| Managed Ollama cloud | One-click hosted Ollama with GPU (modol handles infra) |

### Alternative Revenue Paths
1. **Consulting/Integration**: Help enterprises deploy modol with their internal LLM endpoints
2. **modol Cloud**: Hosted version with managed GPU for teams that don't want to run Ollama locally
3. **Sponsorship/Donations**: GitHub Sponsors, Open Collective

### Recommendation
Start with 100% free. Build community first. Explore managed cloud offering only after reaching 10K+ active users. The open-source credibility is more valuable than early monetization.

---

## Execution Timeline Summary

| Phase | Timeline | Deliverables | Acceptance Criteria |
|-------|----------|-------------|-------------------|
| 0: Monorepo | Day 0 | pnpm workspace, @modol/core extracted | `pnpm build` succeeds, existing tests pass, `modol` CLI still works |
| 1: Terminal | Day 1 | `extension.ts`, terminal panel, status bar | Can open modol terminal from VS Code, chat works |
| 2: Sidebar | Week 1 | Webview chat, message protocol, editor integration | Sidebar chat works, selected text -> modol -> apply to editor |
| 3: Advanced | Week 2-3 | Inline completions, code actions, diagnostics, diff | All features work, no regressions |
| 4: Publish | Week 3 | Marketplace listing, CI/CD, README | Extension live on Marketplace and Open VSX |
| 5: Marketing | Week 4+ | Launch posts, community engagement | First 100 installs |

---

## Open Questions

See `.omc/plans/open-questions.md` for tracked items.

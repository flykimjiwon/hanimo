import { useCallback, useRef } from 'react';
import {
  loadGlobalInstructions,
  saveGlobalInstructions,
  appendGlobalInstructions,
  clearGlobalInstructions,
  getInstructionsPath,
} from '../../core/instructions.js';
import { KNOWN_MODELS, PROVIDER_NAMES } from '../../providers/types.js';
import { THEME_PRESETS, getThemeById } from '../themes.js';
import { setTheme } from '../theme.js';
import type { ProviderName } from '../../providers/types.js';
import { getModelCapability, ROLE_BADGES, ROLE_LABELS } from '../../providers/model-capabilities.js';

export interface CommandInfo {
  name: string;
  description: string;
  descriptionKo: string;
  shortcut?: string;
}

// Palette-only commands (items accessible via Esc menu are excluded)
export const COMMAND_LIST: CommandInfo[] = [
  { name: 'config', description: 'Show current configuration', descriptionKo: '현재 설정 보기' },
  { name: 'usage', description: 'Token usage & cost', descriptionKo: '토큰 사용량 & 비용' },
  { name: 'models', description: 'List models with badges', descriptionKo: '모델 목록 (역할 뱃지 포함)' },
  { name: 'instructions', description: 'View/set global instructions', descriptionKo: '전역 지침 보기/설정' },
  { name: 'save', description: 'Save current session', descriptionKo: '현재 세션 저장', shortcut: 'Ctrl+X S' },
  { name: 'load', description: 'Load a saved session', descriptionKo: '저장된 세션 불러오기', shortcut: 'Ctrl+X L' },
  { name: 'sessions', description: 'List recent sessions', descriptionKo: '최근 세션 목록', shortcut: 'Ctrl+X E' },
  { name: 'mode', description: 'Switch mode preset (turbo/balanced/eco/auto)', descriptionKo: '모드 프리셋 전환 (터보/균형/효율/자동)' },
  { name: 'endpoint', description: 'Set/view provider base URL', descriptionKo: '프로바이더 엔드포인트 URL 설정' },
  { name: 'auto', description: 'Autonomous mode (work until done)', descriptionKo: '자율 모드 (완료까지 자동 실행)' },
  { name: 'search', description: 'Search sessions by keyword', descriptionKo: '세션 키워드 검색' },
  { name: 'diagnostics', description: 'Run tsc/eslint checks', descriptionKo: 'TypeScript/ESLint 진단 실행' },
];

export interface CommandContext {
  provider: string;
  model: string;
  toolsEnabled: boolean;
  usage: { promptTokens: number; completionTokens: number; totalCost: number };
  addSystemMessage: (content: string) => void;
  clearMessages: () => void;
  switchModel: (name: string) => void;
  switchProvider: (name: string) => void;
  toggleTools: (on?: boolean) => void;
  exitApp: () => void;
  openModelMenu: () => void;
  openProviderMenu: () => void;
  switchRole?: (id: string) => void;
  openRoleMenu?: () => void;
  getAllRoles?: () => Array<{ id: string; name: string; icon: string; description: string }>;
  currentRoleId?: string;
  saveSession?: () => void;
  openSessionsMenu?: () => void;
  listRecentSessions?: () => string;
}

export interface CommandResult {
  handled: boolean;
}

type CommandHandler = (args: string, ctx: CommandContext) => void;

const COMMAND_MAP: Record<string, CommandHandler> = {
  help: (_args, ctx) => {
    ctx.addSystemMessage(
      [
        'Available commands:',
        '  /help, /h         Show this help',
        '  /clear            Clear conversation',
        '  /exit, /quit, /q  Exit modol',
        '  /model, /m [name] Switch model (no arg = show menu)',
        '  /provider, /p [n] Switch provider (no arg = show menu)',
        '  /role [id]        Switch role (no arg = show menu)',
        '  /roles            List all available roles',
        '  /tools, /t [on|off] Toggle tools',
        '  /models           List models with role badges',
        '  /config           Show current configuration',
        '  /usage, /u        Show token usage & cost',
        '  /instructions [text] View/set/clear global instructions',
        '  /save             Save current session',
        '  /load             Load a saved session',
        '  /sessions         List recent sessions',
        '  /mode [preset]    Mode preset (auto/turbo/balanced/eco)',
        '  /endpoint [url]   Set provider base URL (e.g. DGX SPARK)',
        '  /auto [msg]       Autonomous mode — work until done',
        '  /search [keyword] Search sessions by keyword',
        '  /diagnostics [f]  Run tsc/eslint diagnostics',
        '',
        'Shortcuts:',
        '  Esc               Open menu',
        '  Ctrl+K            Command palette',
        '  Ctrl+X [key]      Leader key (S=save L=load K=palette V=verbose)',
        '  Up/Down           Input history',
        '  Tab               Autocomplete commands',
      ].join('\n'),
    );
  },

  h: (args, ctx) => COMMAND_MAP['help']!(args, ctx),

  clear: (_args, ctx) => {
    ctx.clearMessages();
    ctx.addSystemMessage('Conversation cleared.');
  },

  // Shortcut aliases (match text-mode for consistency)
  m: (args, ctx) => COMMAND_MAP['model']!(args, ctx),
  p: (args, ctx) => COMMAND_MAP['provider']!(args, ctx),
  t: (args, ctx) => COMMAND_MAP['tools']!(args, ctx),

  exit: (_args, ctx) => ctx.exitApp(),
  quit: (_args, ctx) => ctx.exitApp(),
  q: (_args, ctx) => ctx.exitApp(),

  model: (args, ctx) => {
    const name = args.trim();
    if (!name) {
      ctx.openModelMenu();
      return;
    }
    ctx.switchModel(name);
  },

  provider: (args, ctx) => {
    const name = args.trim();
    if (!name) {
      ctx.openProviderMenu();
      return;
    }
    if (!PROVIDER_NAMES.includes(name as ProviderName)) {
      ctx.addSystemMessage(`Unknown provider: "${name}". Available: ${PROVIDER_NAMES.join(', ')}`);
      return;
    }
    ctx.switchProvider(name);
  },

  tools: (args, ctx) => {
    const arg = args.trim().toLowerCase();
    if (arg === 'on') {
      ctx.toggleTools(true);
    } else if (arg === 'off') {
      ctx.toggleTools(false);
    } else {
      ctx.toggleTools();
    }
  },

  config: (_args, ctx) => {
    const models = KNOWN_MODELS[ctx.provider] ?? [];
    const cap = getModelCapability(ctx.model, ctx.provider);
    ctx.addSystemMessage(
      [
        'Current configuration:',
        `  Provider:  ${ctx.provider}`,
        `  Model:     ${ctx.model}`,
        `  Role:      ${ROLE_LABELS[cap.role]} ${ROLE_BADGES[cap.role]}`,
        `  Tools:     ${ctx.toolsEnabled ? 'ON' : 'OFF'}`,
        '',
        `  Available models for ${ctx.provider}:`,
        ...models.map((m: string) => {
          const mc = getModelCapability(m, ctx.provider);
          const badge = ROLE_BADGES[mc.role];
          const marker = m === ctx.model ? '\u25CF' : '\u25CB';
          return `    ${marker} ${m}  ${badge}`;
        }),
      ].join('\n'),
    );
  },

  usage: (_args, ctx) => {
    const { promptTokens, completionTokens, totalCost } = ctx.usage;
    const total = promptTokens + completionTokens;
    const costStr = totalCost === 0 ? '$0' : totalCost < 0.01 ? `$${totalCost.toFixed(4)}` : `$${totalCost.toFixed(2)}`;
    ctx.addSystemMessage(
      [
        'Token usage:',
        `  Prompt:      ${promptTokens.toLocaleString()}`,
        `  Completion:  ${completionTokens.toLocaleString()}`,
        `  Total:       ${total.toLocaleString()}`,
        `  Cost:        ${costStr}`,
      ].join('\n'),
    );
  },

  u: (args, ctx) => COMMAND_MAP['usage']!(args, ctx),

  role: (args, ctx) => {
    const id = args.trim();
    if (!id) {
      if (ctx.openRoleMenu) {
        ctx.openRoleMenu();
      } else {
        ctx.addSystemMessage('Role menu not available.');
      }
      return;
    }
    if (ctx.switchRole) {
      ctx.switchRole(id);
    } else {
      ctx.addSystemMessage('Role switching not available.');
    }
  },

  roles: (_args, ctx) => {
    if (!ctx.getAllRoles) {
      ctx.addSystemMessage('Role system not available.');
      return;
    }
    const roles = ctx.getAllRoles();
    const lines = roles.map(r => {
      const marker = r.id === ctx.currentRoleId ? '\u25CF' : '\u25CB';
      return `  ${marker} ${r.icon} ${r.id.padEnd(10)} ${r.name.padEnd(12)} ${r.description}`;
    });
    ctx.addSystemMessage(
      [
        'Available roles:',
        '',
        ...lines,
        '',
        'Use /role <id> to switch roles.',
      ].join('\n'),
    );
  },

  theme: (args, ctx) => {
    const id = args.trim();
    if (!id) {
      const lines = THEME_PRESETS.map((t) => `  ${t.id.padEnd(14)} ${t.name.padEnd(18)} ${t.description}`);
      ctx.addSystemMessage(['Available themes:', '', ...lines, '', 'Use /theme <id> to switch.'].join('\n'));
      return;
    }
    const preset = getThemeById(id);
    if (!preset) {
      ctx.addSystemMessage(`Unknown theme: "${id}". Use /theme to see available themes.`);
      return;
    }
    setTheme(preset.colors);
    ctx.addSystemMessage(`Theme: ${preset.name} — ${preset.description}`);
  },

  instructions: (args, ctx) => {
    const arg = args.trim();
    if (!arg) {
      const current = loadGlobalInstructions();
      if (!current) {
        ctx.addSystemMessage(`No global instructions set.\nFile: ${getInstructionsPath()}\n\nUsage:\n  /instructions <text>     Set instructions\n  /instructions add <text> Append instructions\n  /instructions clear      Clear all instructions`);
      } else {
        ctx.addSystemMessage(`Global instructions:\n\n${current}\n\nFile: ${getInstructionsPath()}`);
      }
      return;
    }
    if (arg === 'clear') {
      clearGlobalInstructions();
      ctx.addSystemMessage('Global instructions cleared.');
      return;
    }
    if (arg.startsWith('add ')) {
      const text = arg.slice(4).trim();
      if (text) {
        appendGlobalInstructions(text);
        ctx.addSystemMessage(`Instruction appended: "${text}"`);
      }
      return;
    }
    saveGlobalInstructions(arg);
    ctx.addSystemMessage(`Global instructions set: "${arg}"`);
  },

  save: (_args, ctx) => {
    if (ctx.saveSession) {
      ctx.saveSession();
    } else {
      ctx.addSystemMessage('Session save not available.');
    }
  },

  load: (_args, ctx) => {
    if (ctx.openSessionsMenu) {
      ctx.openSessionsMenu();
    } else {
      ctx.addSystemMessage('Session load not available.');
    }
  },

  sessions: (_args, ctx) => {
    if (ctx.listRecentSessions) {
      ctx.addSystemMessage(ctx.listRecentSessions());
    } else {
      ctx.addSystemMessage('Session list not available.');
    }
  },

  mode: (args, ctx) => {
    const modeId = args.trim().toLowerCase();
    if (!modeId) {
      ctx.addSystemMessage(
        [
          'Mode presets — 역할별 최적 모델 자동 배정:',
          '',
          '  /mode auto       🐶 자동 — 역할별 최적 모델 자동 배정',
          '  /mode turbo      🚀 터보 — 최고 성능 (가장 큰 모델)',
          '  /mode balanced   ⚖️  균형 — 성능과 속도 균형',
          '  /mode eco        🌱 효율 — 최고 속도 (가장 작은 모델)',
          '  /mode show       📋 현재 프리셋 상세 보기',
          '',
          'Example: /mode turbo',
        ].join('\n'),
      );
      return;
    }

    if (modeId === 'show') {
      try {
        const fs = require('node:fs');
        const path = require('node:path');
        const os = require('node:os');
        const configPath = path.join(os.homedir(), '.modol', 'config.json');
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const currentMode = cfg.modePreset ?? 'auto';
        const assignments = cfg.modeAssignments ?? {};
        const lines = [
          `Current mode: ${currentMode}`,
          '',
          `  Super:  ${assignments.super ?? '(not set)'}`,
          `  Dev:    ${assignments.dev ?? '(not set)'}`,
          `  Plan:   ${assignments.plan ?? '(not set)'}`,
          `  Chat:   ${assignments.chat ?? '(not set)'}`,
        ];
        ctx.addSystemMessage(lines.join('\n'));
      } catch {
        ctx.addSystemMessage('No mode configured. Use /mode auto to auto-detect.');
      }
      return;
    }

    const validModes = ['auto', 'turbo', 'balanced', 'eco'];
    if (!validModes.includes(modeId)) {
      ctx.addSystemMessage(`Unknown mode: "${modeId}". Available: ${validModes.join(', ')}`);
      return;
    }

    // Save mode selection to config and trigger model reassignment
    try {
      const fs = require('node:fs');
      const path = require('node:path');
      const os = require('node:os');
      const configDir = path.join(os.homedir(), '.modol');
      fs.mkdirSync(configDir, { recursive: true });
      const configPath = path.join(configDir, 'config.json');
      let cfg: Record<string, unknown> = {};
      try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { /* empty */ }
      cfg.modePreset = modeId;
      fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });

      const icons: Record<string, string> = { auto: '🐶', turbo: '🚀', balanced: '⚖️', eco: '🌱' };
      const names: Record<string, string> = { auto: '자동', turbo: '터보', balanced: '균형', eco: '효율' };
      ctx.addSystemMessage(
        `${icons[modeId]} Mode: ${names[modeId]} (${modeId})\nRestart modol to apply model assignments.\nOr use /mode show to see assignments.`,
      );
    } catch (err: unknown) {
      ctx.addSystemMessage(`Failed to save mode: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  endpoint: (args, ctx) => {
    const parts = args.trim().split(/\s+/);
    const sub = parts[0] ?? '';

    if (!sub || sub === 'help') {
      ctx.addSystemMessage(
        [
          'Endpoint management:',
          '  /endpoint list                          Show registered endpoints',
          '  /endpoint add <name> <provider> <url> [apiKey]   Add endpoint',
          '  /endpoint remove <name>                 Remove endpoint',
          '',
          'Examples:',
          '  /endpoint add local ollama http://localhost:11434',
          '  /endpoint add dgx custom https://spark3-share.tech-2030.net/api/v1 f0a26c07...',
          '  /endpoint add remote ollama http://192.168.1.100:11434',
          '  /endpoint remove dgx',
          '  /endpoint list',
          '',
          'Config file: ~/.modol/config.json (endpoints array)',
        ].join('\n'),
      );
      return;
    }

    if (sub === 'list') {
      try {
        const fs = require('node:fs');
        const path = require('node:path');
        const os = require('node:os');
        const configPath = path.join(os.homedir(), '.modol', 'config.json');
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const eps = cfg.endpoints ?? [];
        if (eps.length === 0) {
          ctx.addSystemMessage('No endpoints registered.\nUse /endpoint add <name> <provider> <url> to add one.');
          return;
        }
        const lines = eps.map((e: { name: string; provider: string; baseURL: string; apiKey?: string; enabled?: boolean; priority?: number }, i: number) => {
          const key = e.apiKey ? '🔑' : '  ';
          const status = e.enabled === false ? '⏸' : '✅';
          return `  ${i + 1}. ${status} ${key} ${e.name.padEnd(16)} ${e.provider.padEnd(8)} ${e.baseURL}${e.priority ? ` (priority:${e.priority})` : ''}`;
        });
        ctx.addSystemMessage(['Registered endpoints:', '', ...lines].join('\n'));
      } catch {
        ctx.addSystemMessage('No config found. Use /endpoint add to register endpoints.');
      }
      return;
    }

    if (sub === 'add') {
      const [, name, provider, url, apiKey] = parts;
      if (!name || !provider || !url) {
        ctx.addSystemMessage('Usage: /endpoint add <name> <provider> <url> [apiKey]\nExample: /endpoint add local ollama http://localhost:11434');
        return;
      }
      try {
        const fs = require('node:fs');
        const path = require('node:path');
        const os = require('node:os');
        const configDir = path.join(os.homedir(), '.modol');
        fs.mkdirSync(configDir, { recursive: true });
        const configPath = path.join(configDir, 'config.json');
        let cfg: Record<string, unknown> = {};
        try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch { /* empty */ }
        const eps = (cfg.endpoints ?? []) as Array<Record<string, unknown>>;
        // Remove existing with same name
        const filtered = eps.filter((e: Record<string, unknown>) => e.name !== name);
        const newEp: Record<string, unknown> = { name, provider, baseURL: url, enabled: true, priority: 0 };
        if (apiKey) newEp.apiKey = apiKey;
        filtered.push(newEp);
        cfg.endpoints = filtered;
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
        ctx.addSystemMessage(`✅ Endpoint "${name}" added (${provider} @ ${url})${apiKey ? ' with API key' : ''}\nRestart modol to use new endpoint.`);
      } catch (err: unknown) {
        ctx.addSystemMessage(`❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    if (sub === 'remove') {
      const name = parts[1];
      if (!name) {
        ctx.addSystemMessage('Usage: /endpoint remove <name>');
        return;
      }
      try {
        const fs = require('node:fs');
        const path = require('node:path');
        const os = require('node:os');
        const configPath = path.join(os.homedir(), '.modol', 'config.json');
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const eps = (cfg.endpoints ?? []) as Array<Record<string, unknown>>;
        const before = eps.length;
        cfg.endpoints = eps.filter((e: Record<string, unknown>) => e.name !== name);
        if (cfg.endpoints.length === before) {
          ctx.addSystemMessage(`Endpoint "${name}" not found.`);
          return;
        }
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
        ctx.addSystemMessage(`✅ Endpoint "${name}" removed.\nRestart modol to apply.`);
      } catch (err: unknown) {
        ctx.addSystemMessage(`❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return;
    }

    // If user typed a URL directly: /endpoint https://...
    if (sub.startsWith('http://') || sub.startsWith('https://')) {
      ctx.addSystemMessage(
        [
          `URL detected: ${sub}`,
          '',
          'To register this endpoint, use:',
          `  /endpoint add <name> <provider> ${sub} [apiKey]`,
          '',
          'Example:',
          `  /endpoint add myserver ollama ${sub}`,
          `  /endpoint add myserver custom ${sub} YOUR_API_KEY`,
        ].join('\n'),
      );
      return;
    }

    ctx.addSystemMessage(`Unknown subcommand: "${sub}". Use /endpoint help for usage.`);
  },

  auto: (args, ctx) => {
    const msg = args.trim();
    if (!msg) {
      ctx.addSystemMessage('Usage: /auto <task description>\nExample: /auto Fix all TypeScript errors in src/');
      return;
    }
    // Send the message prefixed with [AUTO] — the agent loop will handle it
    ctx.addSystemMessage(`🔄 Auto mode started: "${msg}"\nThe agent will work autonomously until complete.`);
    // Delegate to sendMessage which will trigger auto-loop in app.tsx
    (ctx as unknown as { sendAutoMessage?: (m: string) => void }).sendAutoMessage?.(msg);
  },

  search: (args, ctx) => {
    const keyword = args.trim();
    if (!keyword) {
      ctx.addSystemMessage('Usage: /search <keyword>\nSearches message content across saved sessions.');
      return;
    }
    if ((ctx as unknown as { searchSessions?: (k: string) => string }).searchSessions) {
      ctx.addSystemMessage((ctx as unknown as { searchSessions: (k: string) => string }).searchSessions(keyword));
    } else {
      ctx.addSystemMessage('Session search not available.');
    }
  },

  diagnostics: (args, ctx) => {
    const file = args.trim() || undefined;
    ctx.addSystemMessage(`Running diagnostics${file ? ` for ${file}` : ' (project-wide)'}...`);
    // Trigger diagnostics via the agent — send as a user message
    const prompt = file
      ? `Run the diagnostics tool on file "${file}" and show me the results.`
      : 'Run the diagnostics tool on the whole project and show me the results.';
    (ctx as unknown as { sendMessage?: (m: string) => void }).sendMessage?.(prompt);
  },

  'models-refresh': (_args, ctx) => {
    ctx.addSystemMessage('Refreshing model registry from OpenRouter...');
    import('../../providers/model-registry.js').then(({ refreshModelRegistry, getRegistrySummary }) => {
      refreshModelRegistry().then(() => {
        getRegistrySummary().then(summary => {
          ctx.addSystemMessage(`✅ Model registry updated: ${summary}`);
        });
      });
    }).catch(() => {
      ctx.addSystemMessage('❌ Failed to refresh model registry.');
    });
  },

  models: (_args, ctx) => {
    const models = KNOWN_MODELS[ctx.provider] ?? [];
    if (models.length === 0) {
      ctx.addSystemMessage(`No known models for provider "${ctx.provider}". Use /model <name> to set manually.`);
      return;
    }
    const lines = models.map((m: string) => {
      const cap = getModelCapability(m, ctx.provider);
      const badge = ROLE_BADGES[cap.role];
      const label = ROLE_LABELS[cap.role].padEnd(6);
      const marker = m === ctx.model ? '\u25CF' : '\u25CB';
      const note = cap.note ? `  (${cap.note})` : '';
      return `  ${marker} ${m.padEnd(28)} ${badge} ${label}${note}`;
    });
    ctx.addSystemMessage(
      [
        `Models for ${ctx.provider}:`,
        '',
        ...lines,
        '',
        'Roles: [A] Agent (full tools)  [R] Read-only (assist)  [C] Chat (no tools)',
      ].join('\n'),
    );
  },
};

export const COMMAND_NAMES = Object.keys(COMMAND_MAP);

export function useCommands(): {
  handleCommand: (input: string, ctx: CommandContext) => CommandResult;
} {
  const ctxRef = useRef<CommandContext | null>(null);

  const handleCommand = useCallback(
    (input: string, ctx: CommandContext): CommandResult => {
      ctxRef.current = ctx;

      if (!input.startsWith('/')) {
        return { handled: false };
      }

      const trimmed = input.slice(1);
      const spaceIdx = trimmed.indexOf(' ');
      const cmd = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
      const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1);

      const handler = COMMAND_MAP[cmd.toLowerCase()];
      if (!handler) {
        ctx.addSystemMessage(`Unknown command: /${cmd}. Type /help for available commands.`);
        return { handled: true };
      }

      handler(args, ctx);
      return { handled: true };
    },
    [],
  );

  return { handleCommand };
}

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

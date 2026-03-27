import { useCallback, useRef } from 'react';
import { KNOWN_MODELS, PROVIDER_NAMES } from '../../providers/types.js';
import type { ProviderName } from '../../providers/types.js';
import { getModelCapability, ROLE_BADGES, ROLE_LABELS } from '../../providers/model-capabilities.js';

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
        '  /exit, /quit, /q  Exit devany',
        '  /model, /m [name] Switch model (no arg = show menu)',
        '  /provider, /p [n] Switch provider (no arg = show menu)',
        '  /tools, /t [on|off] Toggle tools',
        '  /models           List models with role badges',
        '  /config           Show current configuration',
        '  /usage, /u        Show token usage & cost',
        '',
        'Shortcuts:',
        '  Esc               Open menu',
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

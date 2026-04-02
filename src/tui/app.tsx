import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { render, Box, Text, useApp, useInput, useStdout } from 'ink';
import type { LanguageModelV1, ToolSet } from 'ai';
// StatusBar removed — info shown in bottom hints instead
import { ChatView } from './components/chat-view.js';
import { InputBar } from './components/input-bar.js';
import { SelectMenu } from './components/select-menu.js';
import type { MenuItem } from './components/select-menu.js';
import { useAgent } from './hooks/use-agent.js';
import { useCommands, COMMAND_NAMES, COMMAND_LIST } from './hooks/use-commands.js';
import type { CommandContext } from './hooks/use-commands.js';
import { colors, setTheme } from './theme.js';
import { THEME_PRESETS } from './themes.js';
import type { ThemeColors } from './themes.js';
import { LOCAL_PROVIDERS, KNOWN_MODELS, PROVIDER_NAMES } from '../providers/types.js';
import type { ProviderName } from '../providers/types.js';
import { getModel, clearProviderCache } from '../providers/registry.js';
import { getModelCapability, ROLE_BADGES } from '../providers/model-capabilities.js';
import type { ModelRole } from '../providers/model-capabilities.js';
import { createReadOnlyTools } from '../tools/registry.js';
import type { RoleManager } from '../roles/role-manager.js';
import type { RoleDefinition } from '../roles/types.js';

import { unlinkSync } from 'node:fs';
import { join as joinPath } from 'node:path';
import { homedir } from 'node:os';
import { buildSystemPrompt } from '../core/system-prompt.js';
import { runAutoLoop } from '../core/auto-loop.js';
import { SessionStore } from '../session/store.js';
import { useLeaderKey } from './hooks/use-leader-key.js';
import { CommandPalette } from './components/command-palette.js';
import type { PaletteItem } from './components/command-palette.js';
import { WelcomeScreen } from './components/welcome-screen.js';
import { printExitSummary } from './exit-summary.js';
import type { SessionStats } from './exit-summary.js';

type MenuState = 'none' | 'main' | 'model' | 'provider' | 'lang' | 'role' | 'palette' | 'sessions' | 'theme';

// Module-level session stats — updated by App, read by startApp on exit
let sessionStatsSnapshot: SessionStats | null = null;
const sessionStartTime = Date.now();
const sessionId = crypto.randomUUID();

const ROLE_DESC_KO: Record<string, string> = {
  hanimo: '만능 모드 — 의도 자동 감지, 코딩/대화/분석/시스템 관리 ⚡',
  dev: '코딩 에이전트 — 파일 읽기/쓰기, 셸, git',
  plan: '분석/계획 — 읽기 전용, 수정 불가',
};

interface AppProps {
  provider: string;
  model: string;
  modelInstance: LanguageModelV1;
  systemPrompt: string;
  tools?: ToolSet;
  initialPrompt?: string;
  providerConfig?: { apiKey?: string; baseURL?: string };
  roleManager?: import('../roles/role-manager.js').RoleManager;
  activeRole?: import('../roles/types.js').RoleDefinition;
  streaming?: boolean;
}

function KeyHints({ isLoading, menuOpen, leaderActive, lang, statusInfo }: {
  isLoading: boolean; menuOpen: boolean; leaderActive: boolean; lang: string;
  statusInfo?: string;
}): React.ReactElement {
  const ko = lang === 'ko';
  if (leaderActive) return <Box width="100%" paddingX={1} justifyContent="center"><Text color={colors.warning}>{'LEADER: K=\uD314\uB808\uD2B8  S=\uC800\uC7A5  L=\uBD88\uB7EC\uC624\uAE30  V=verbose  C=\uCD08\uAE30\uD654  H=\uB3C4\uC6C0\uB9D0'}</Text></Box>;
  if (menuOpen) return <Box width="100%" paddingX={1} justifyContent="center"><Text color={colors.hint}>{ko ? 'Esc \uBA54\uB274 \uB2EB\uAE30' : 'Esc close menu'}</Text></Box>;
  return (
    <Box width="100%" paddingX={1} justifyContent="space-between">
      <Text color={colors.hint}>
        {isLoading
          ? ko ? 'Ctrl+C \uCDE8\uC18C' : 'Ctrl+C cancel'
          : ko ? 'Esc \uBA54\uB274  |  / \uBA85\uB839\uC5B4' : 'Esc menu  |  / commands'}
      </Text>
      {statusInfo && <Text color={colors.dimText}>{statusInfo}</Text>}
    </Box>
  );
}

// Error boundary — catches render errors gracefully
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={1} paddingY={1}>
          <Text color={colors.error} bold>
            TUI Render Error
          </Text>
          <Text color={colors.error}>{this.state.error.message}</Text>
          <Text color={colors.dimText}>Press Ctrl+C to exit</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

function App({
  provider: initialProvider,
  model: initialModel,
  modelInstance,
  systemPrompt,
  tools,
  initialPrompt,
  providerConfig,
  roleManager,
  activeRole: initialRole,
  streaming,
}: AppProps): React.ReactElement {
  const app = useApp();
  const { stdout } = useStdout();

  // Dynamic provider/model state
  const [currentProvider, setCurrentProvider] = useState(initialProvider);
  const [currentModel, setCurrentModel] = useState(initialModel);
  const [termRows, setTermRows] = useState(stdout?.rows ?? 24);
  const [menuState, setMenuState] = useState<MenuState>('none');

  // Role state
  const [currentRole, setCurrentRole] = useState(initialRole);
  const [currentTools, setCurrentTools] = useState(tools);
  const [currentSystemPrompt, setCurrentSystemPrompt] = useState(systemPrompt);

  // Verbose mode (Ctrl+O toggle — expand/collapse tool results)
  const [verbose, setVerbose] = useState(false);

  // Welcome screen: show until first message is sent
  const [showWelcome, setShowWelcome] = useState(true);

  // Delay initial render to avoid Ink accumulating partial renders during state setup
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  // Current theme ID (for banner color scheme)
  const [currentThemeId, setCurrentThemeId] = useState('catppuccin');

  // Session store
  const sessionStoreRef = useRef(new SessionStore());

  // Theme preview: save original before preview, restore on cancel
  const themeBeforePreviewRef = useRef<ThemeColors | null>(null);

  // Leader key (Ctrl+X prefix)
  const leader = useLeaderKey();

  // Role-based capability detection
  const initialCap = getModelCapability(initialModel, initialProvider);
  const [modelRole, setModelRole] = useState<ModelRole>(initialCap.role);
  const [toolsEnabled, setToolsEnabled] = useState(initialCap.role !== 'chat');

  // Language setting
  const [currentLang, setCurrentLang] = useState<string>('ko');

  // Determine effective tools based on role
  const effectiveTools = useMemo(() => {
    if (!toolsEnabled) return undefined;
    if (currentTools) return currentTools;
    if (modelRole === 'agent') return tools;
    if (modelRole === 'assistant') return createReadOnlyTools() as ToolSet;
    return undefined; // chat
  }, [toolsEnabled, modelRole, tools, currentTools]);

  const agent = useAgent({
    model: modelInstance,
    systemPrompt: currentSystemPrompt,
    tools: effectiveTools,
    streaming,
  });

  // Session save (uses refs — stable callback)
  const saveSession = useCallback(() => {
    const store = sessionStoreRef.current;
    const msgs = agentRef.current.messages;
    if (msgs.length === 0) {
      agentRef.current.addSystemMessage('Nothing to save.');
      return;
    }
    const id = store.createSession(currentProviderRef.current, currentModelRef.current);
    for (const msg of msgs) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        store.saveMessage(id, msg.role, msg.content);
      }
    }
    agentRef.current.addSystemMessage(`Session saved (${id.slice(0, 8)}...)`);
  }, []);

  // Session list text (for /sessions command)
  const listRecentSessions = useCallback((): string => {
    const sessions = sessionStoreRef.current.listSessions(10);
    if (sessions.length === 0) return 'No saved sessions.';
    const lines = sessions.map((s, i) => {
      const date = new Date(s.updatedAt).toLocaleString();
      return `  ${i + 1}. ${s.provider}/${s.model} (${s.messageCount} msgs) ${date}  [${s.id.slice(0, 8)}]`;
    });
    return ['Recent sessions:', '', ...lines, '', 'Use /load to open a session.'].join('\n');
  }, []);

  // Role switching
  const switchRole = useCallback((id: string) => {
    if (!roleManager) {
      agent.addSystemMessage('Role system not available.');
      return;
    }
    const role = roleManager.getRole(id);
    if (!role) {
      const available = roleManager.getAllRoles().map(r => r.id).join(', ');
      agent.addSystemMessage(`Unknown role: "${id}". Available: ${available}`);
      return;
    }
    setCurrentRole(role);
    const newTools = roleManager.createToolSet(role);
    setCurrentTools(newTools);
    // Auto-toggle tools based on role
    setToolsEnabled(role.tools.length > 0);
    const newPrompt = buildSystemPrompt({ cwd: process.cwd(), platform: process.platform }, role);
    setCurrentSystemPrompt(newPrompt);
    const desc = currentLang === 'ko' ? (ROLE_DESC_KO[role.id] ?? role.description) : role.description;
    const toolsNote = role.tools.length === 0
      ? (currentLang === 'ko' ? ' (도구 꺼짐)' : ' (tools off)')
      : role.id === 'plan'
        ? (currentLang === 'ko' ? ' (읽기 전용)' : ' (read-only)')
        : '';
    agent.addSystemMessage(currentLang === 'ko'
      ? `${role.icon} ${role.name} 역할로 전환: ${desc}${toolsNote}`
      : `Role switched to ${role.icon} ${role.name}: ${role.description}${toolsNote}`);
  }, [agent, roleManager, currentLang]);

  const { handleCommand } = useCommands();

  // Track terminal resize
  useEffect(() => {
    const onResize = (): void => {
      setTermRows(stdout?.rows ?? 24);
    };
    stdout?.on('resize', onResize);
    return () => {
      stdout?.off('resize', onResize);
    };
  }, [stdout]);

  // Handle Ctrl+C — double-tap always exits, single tap cancels or exits
  const ctrlCCountRef = useRef(0);
  const ctrlCTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentRef = useRef(agent);
  agentRef.current = agent;

  // Refs for command context
  const currentProviderRef = useRef(currentProvider);
  const currentModelRef = useRef(currentModel);
  const toolsEnabledRef = useRef(toolsEnabled);
  currentProviderRef.current = currentProvider;
  currentModelRef.current = currentModel;
  toolsEnabledRef.current = toolsEnabled;

  // Track current model instance for auto loop
  const currentModelInstanceRef = useRef<LanguageModelV1>(modelInstance);
  const currentSystemPromptRef = useRef(currentSystemPrompt);
  const currentToolsRef = useRef(effectiveTools);
  currentModelInstanceRef.current = modelInstance;
  currentSystemPromptRef.current = currentSystemPrompt;
  currentToolsRef.current = effectiveTools;

  const switchModel = useCallback((name: string) => {
    // Cancel any in-flight request before switching
    if (agent.isLoading) {
      agent.cancelRun();
    }
    try {
      const newModelInstance = getModel(
        currentProviderRef.current as ProviderName,
        name,
        providerConfig,
      );
      agent.updateModel(newModelInstance);
      setCurrentModel(name);

      // Recalculate role
      const cap = getModelCapability(name, currentProviderRef.current);
      setModelRole(cap.role);
      const autoTools = cap.role !== 'chat';
      setToolsEnabled(autoTools);
      const badge = ROLE_BADGES[cap.role];
      const toolsNote = cap.role === 'chat' ? ' (tools disabled)' : cap.role === 'assistant' ? ' (read-only tools)' : '';
      agent.addSystemMessage(`── Model switched to ${name} ${badge}${toolsNote} ──`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      agent.addSystemMessage(`Failed to switch model: ${msg}`);
    }
  }, [agent, providerConfig]);

  const switchProvider = useCallback((name: string) => {
    if (agent.isLoading) {
      agent.cancelRun();
    }
    try {
      clearProviderCache();
      const isLocal = LOCAL_PROVIDERS.has(name as ProviderName);

      // Block cloud providers without API key
      if (!isLocal && !providerConfig?.apiKey) {
        agent.addSystemMessage(
          `⚠️ ${name} requires an API key.\n` +
          `Set with: hanimo --provider ${name} --api-key YOUR_KEY\n` +
          `Or add to ~/.hanimo/config.json:\n` +
          `  "providers": { "${name}": { "apiKey": "..." } }`,
        );
        return;
      }

      const models = KNOWN_MODELS[name] ?? [];
      const defaultModel = models[0] ?? 'default';
      const newModelInstance = getModel(
        name as ProviderName,
        defaultModel,
        isLocal ? {} : providerConfig,
      );
      agent.updateModel(newModelInstance);
      setCurrentProvider(name);
      setCurrentModel(defaultModel);

      // Recalculate role for new provider/model
      const cap = getModelCapability(defaultModel, name);
      setModelRole(cap.role);
      const autoTools = cap.role !== 'chat';
      setToolsEnabled(autoTools);
      const badge = ROLE_BADGES[cap.role];
      agent.addSystemMessage(`── Provider switched to ${name}/${defaultModel} ${badge} ──`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      agent.addSystemMessage(`Failed to switch provider: ${msg}`);
    }
  }, [agent, providerConfig]);

  const toggleTools = useCallback((on?: boolean) => {
    const newState = on !== undefined ? on : !toolsEnabledRef.current;
    // Warn if enabling tools on a chat-only model
    if (newState && modelRole === 'chat') {
      agent.addSystemMessage('Warning: This model does not support tool calling. Tools may not work correctly.');
    }
    setToolsEnabled(newState);
    agent.addSystemMessage(`Tools ${newState ? 'enabled' : 'disabled'}`);
  }, [agent, modelRole]);

  // Build command context
  const commandCtxRef = useRef<CommandContext | null>(null);
  commandCtxRef.current = {
    provider: currentProvider,
    model: currentModel,
    toolsEnabled,
    usage: agent.usage,
    addSystemMessage: agent.addSystemMessage,
    clearMessages: agent.clearMessages,
    switchModel,
    switchProvider,
    toggleTools,
    exitApp: () => app.exit(),
    openModelMenu: () => setMenuState('model'),
    openProviderMenu: () => setMenuState('provider'),
    switchRole,
    openRoleMenu: () => setMenuState('role'),
    getAllRoles: roleManager ? () => roleManager.getAllRoles().map(r => ({ id: r.id, name: r.name, icon: r.icon, description: r.description })) : undefined,
    currentRoleId: currentRole?.id,
    saveSession,
    openSessionsMenu: () => setMenuState('sessions'),
    listRecentSessions,
    sendAutoMessage: (msg: string) => {
      const model = currentModelInstanceRef.current;
      const sysPrompt = currentSystemPromptRef.current;
      const agentTools = currentToolsRef.current ?? {};
      agentRef.current.addSystemMessage('🔄 Auto mode started...');
      runAutoLoop({
        model,
        systemPrompt: sysPrompt,
        tools: agentTools,
        initialMessage: msg,
        onIteration: (iteration, response) => {
          agentRef.current.addSystemMessage(`[Auto ${iteration}] ${response.slice(0, 200)}${response.length > 200 ? '...' : ''}`);
        },
      }).then((result) => {
        agentRef.current.addSystemMessage(`✅ Auto mode complete: ${result.iterations} iterations`);
      }).catch((err: unknown) => {
        const msg2 = err instanceof Error ? err.message : String(err);
        agentRef.current.addSystemMessage(`❌ Auto mode error: ${msg2}`);
      });
    },
  };

  // Input handler: routes to commands or sends as message
  const handleInput = useCallback((text: string) => {
    if (!commandCtxRef.current) return;
    setShowWelcome(false);
    const result = handleCommand(text, commandCtxRef.current);
    if (!result.handled) {
      agent.sendMessage(text);
    }
  }, [agent, handleCommand]);

  // Esc key + Ctrl+C + Leader key handling
  useInput(useCallback((_input: string, key: { ctrl: boolean; escape: boolean }) => {
    // Leader key (Ctrl+X → second key dispatches action)
    const leaderAction = leader.processKey(_input, key);
    if (leaderAction) {
      switch (leaderAction) {
        case 'palette': setMenuState('palette'); break;
        case 'save': saveSession(); break;
        case 'load': setMenuState('sessions'); break;
        case 'verbose':
          setVerbose((prev) => {
            const next = !prev;
            agentRef.current.addSystemMessage(`Verbose mode ${next ? 'ON' : 'OFF'}`);
            return next;
          });
          break;
        case 'clear':
          agentRef.current.clearMessages();
          agentRef.current.addSystemMessage('Conversation cleared.');
          break;
        case 'help':
          if (commandCtxRef.current) handleCommand('/help', commandCtxRef.current);
          break;
        case 'sessions':
          if (commandCtxRef.current) handleCommand('/sessions', commandCtxRef.current);
          break;
      }
      return;
    }

    // Ctrl+K toggles command palette
    if (key.ctrl && _input === 'k') {
      setMenuState((prev) => (prev === 'palette' ? 'none' : 'palette'));
      return;
    }

    if (key.ctrl && _input === 'c') {
      ctrlCCountRef.current++;

      if (agentRef.current.isLoading) {
        agentRef.current.cancelRun();
      }

      if (ctrlCCountRef.current >= 2) {
        if (ctrlCTimerRef.current) clearTimeout(ctrlCTimerRef.current);
        app.exit();
        return;
      }

      if (ctrlCTimerRef.current) clearTimeout(ctrlCTimerRef.current);
      ctrlCTimerRef.current = setTimeout(() => {
        ctrlCCountRef.current = 0;
      }, 1000);

      if (!agentRef.current.isLoading) {
        app.exit();
      }
      return;
    }

    // Ctrl+O toggles verbose mode (expand/collapse tool output)
    if (key.ctrl && _input === 'o') {
      setVerbose((prev) => {
        const next = !prev;
        agentRef.current.addSystemMessage(`Verbose mode ${next ? 'ON' : 'OFF'}`);
        return next;
      });
      return;
    }

    // Esc toggles menu (only when idle and no menu already)
    if (key.escape && !agentRef.current.isLoading) {
      setMenuState((prev) => (prev === 'none' ? 'main' : 'none'));
    }
  }, [app]));

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (ctrlCTimerRef.current) clearTimeout(ctrlCTimerRef.current);
    };
  }, []);

  // Send initial prompt on mount
  useEffect(() => {
    if (initialPrompt && initialPrompt.length > 0) {
      agent.sendMessage(initialPrompt);
    }
  }, []); // Run once on mount

  // Keep session stats snapshot updated for exit summary
  useEffect(() => {
    sessionStatsSnapshot = {
      sessionId,
      toolCalls: agent.toolStats.calls,
      toolSuccesses: agent.toolStats.successes,
      toolErrors: agent.toolStats.errors,
      wallTimeMs: Date.now() - sessionStartTime,
      agentActiveMs: agent.totalActiveMs,
      apiTimeMs: agent.totalActiveMs,
      promptTokens: agent.usage.promptTokens,
      completionTokens: agent.usage.completionTokens,
      totalCost: agent.usage.totalCost,
    };
  });

  const status = agent.currentTool
    ? ('tool' as const)
    : agent.isLoading
      ? ('thinking' as const)
      : ('idle' as const);

  // Calculate height: status bar (2) + input (7: 5 content + 2 border) + hints (1) + padding (1) + overflow buffer (2) = 13
  // Extra buffer prevents layout overflow on narrow terminals
  const menuHeight = menuState !== 'none' ? 12 : 0;
  const chatHeight = Math.max(termRows - 13 - menuHeight, 3);

  // Tab completions: slash commands + current provider's model names
  const completions = useMemo(() => {
    const cmds = COMMAND_NAMES.map((c) => `/${c}`);
    const models = KNOWN_MODELS[currentProvider] ?? [];
    return [...cmds, ...models];
  }, [currentProvider]);

  // i18n helper
  const ko = currentLang === 'ko';

  // Menu items
  const langLabel = currentLang === 'auto' ? 'Auto' : currentLang === 'ko' ? '한국어' : 'English';
  const roleLabel = currentRole ? `${currentRole.icon} ${currentRole.name}` : 'dev';
  const mainMenuItems: MenuItem[] = ko ? [
    { label: `역할: ${roleLabel}`, value: 'role' },
    { label: '모델 전환', value: 'model' },
    { label: '프로바이더 전환', value: 'provider' },
    { label: '엔드포인트 설정', value: 'endpoint' },
    { label: `언어: ${langLabel}`, value: 'lang' },
    { label: `도구: ${toolsEnabled ? 'ON → OFF' : 'OFF → ON'}`, value: 'tools' },
    { label: '테마 변경', value: 'theme' },
    { label: '대화 초기화', value: 'clear' },
    { label: '설정 초기화', value: 'reset-config' },
    { label: '도움말', value: 'help' },
    { label: '종료', value: 'exit' },
  ] : [
    { label: `Role: ${roleLabel}`, value: 'role' },
    { label: 'Switch Model', value: 'model' },
    { label: 'Switch Provider', value: 'provider' },
    { label: 'Set Endpoint URL', value: 'endpoint' },
    { label: `Language: ${langLabel}`, value: 'lang' },
    { label: `Tools: ${toolsEnabled ? 'ON → OFF' : 'OFF → ON'}`, value: 'tools' },
    { label: 'Theme', value: 'theme' },
    { label: 'Clear Conversation', value: 'clear' },
    { label: 'Reset All Settings', value: 'reset-config' },
    { label: 'Help', value: 'help' },
    { label: 'Exit', value: 'exit' },
  ];

  const roleMenuItems: MenuItem[] = useMemo(() => {
    if (!roleManager) return [];
    return roleManager.getAllRoles().map(r => {
      const desc = ko ? (ROLE_DESC_KO[r.id] ?? r.description) : r.description;
      return {
        label: `${r.icon} ${r.name} — ${desc}`,
        value: r.id,
        active: r.id === currentRole?.id,
      };
    });
  }, [roleManager, currentRole, ko]);

  const langMenuItems: MenuItem[] = [
    { label: '한국어', value: 'ko', active: currentLang === 'ko' },
    { label: 'English', value: 'en', active: currentLang === 'en' },
    { label: 'Auto (no preference)', value: 'auto', active: currentLang === 'auto' },
  ];

  // Dynamic model discovery — fetch real models from provider
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  useEffect(() => {
    // Reset on provider change to avoid showing stale models
    setDiscoveredModels([]);
    let cancelled = false;
    (async () => {
      try {
        const { discoverModelsWithCache } = await import('../providers/model-discovery.js');
        const provConfig = providerConfig;
        const models = await discoverModelsWithCache(currentProvider as import('../providers/types.js').ProviderName, provConfig);
        if (!cancelled && models.length > 0) {
          setDiscoveredModels(models.map(m => m.id));
        }
      } catch {
        // Discovery failed — will fallback to KNOWN_MODELS
      }
    })();
    return () => { cancelled = true; };
  }, [currentProvider, providerConfig]);

  const modelMenuItems: MenuItem[] = useMemo(() => {
    // Prefer discovered (real) models, fallback to hardcoded
    const models = discoveredModels.length > 0 ? discoveredModels : (KNOWN_MODELS[currentProvider] ?? []);
    return models.map((m: string) => {
      const cap = getModelCapability(m, currentProvider);
      const roleColor = cap.role === 'agent' ? colors.success
        : cap.role === 'assistant' ? colors.warning
        : colors.dimText;
      return {
        label: m,
        value: m,
        active: m === currentModel,
        badge: ROLE_BADGES[cap.role],
        badgeColor: roleColor,
      };
    });
  }, [currentProvider, currentModel, discoveredModels]);

  const providerMenuItems: MenuItem[] = useMemo(() => {
    return PROVIDER_NAMES
      .filter((p) => {
        // Show all providers — local providers don't need keys, cloud providers configurable later
        if (LOCAL_PROVIDERS.has(p)) return true;
        return true;
      })
      .map((p) => ({
        label: LOCAL_PROVIDERS.has(p) ? `${p} (local)` : p,
        value: p,
        active: p === currentProvider,
      }));
  }, [currentProvider, providerConfig]);

  const themeMenuItems: MenuItem[] = useMemo(() => {
    return THEME_PRESETS.map((t) => ({
      label: `${t.name} — ${t.description}`,
      value: t.id,
    }));
  }, []);

  const handleThemeHighlight = useCallback((value: string) => {
    const preset = THEME_PRESETS.find((t) => t.id === value);
    if (preset) setTheme(preset.colors);
  }, []);

  const handleThemeMenuSelect = useCallback((value: string) => {
    themeBeforePreviewRef.current = null; // commit the preview
    const preset = THEME_PRESETS.find((t) => t.id === value);
    if (preset) {
      setCurrentThemeId(preset.id);
      agent.addSystemMessage(ko ? `테마: ${preset.name} — ${preset.description}` : `Theme: ${preset.name} — ${preset.description}`);
    }
    setMenuState('none');
  }, [agent, ko]);

  const handleThemeMenuCancel = useCallback(() => {
    // Restore original theme on cancel
    if (themeBeforePreviewRef.current) {
      setTheme(themeBeforePreviewRef.current);
      themeBeforePreviewRef.current = null;
    }
    setMenuState('none');
  }, []);

  const handleRoleMenuSelect = useCallback((value: string) => {
    switchRole(value);
    setMenuState('none');
  }, [switchRole]);

  const handleMainMenuSelect = useCallback((value: string) => {
    switch (value) {
      case 'role':
        setMenuState('role');
        break;
      case 'model':
        setMenuState('model');
        break;
      case 'provider':
        setMenuState('provider');
        break;
      case 'lang':
        setMenuState('lang');
        break;
      case 'tools':
        toggleTools();
        setMenuState('none');
        break;
      case 'theme':
        themeBeforePreviewRef.current = { ...colors };
        setMenuState('theme');
        break;
      case 'endpoint':
        agent.addSystemMessage(
          ko
            ? '엔드포인트 관리:\n  /endpoint list                          등록된 엔드포인트 목록\n  /endpoint add <이름> <프로바이더> <URL> [API키]\n  /endpoint remove <이름>\n\n예시:\n  /endpoint add local ollama http://localhost:11434\n  /endpoint add openai-api openai https://api.openai.com/v1 sk-...\n  /endpoint add remote ollama http://192.168.1.100:11434\n\n또는 CLI에서:\n  hanimo --base-url <url> --api-key <key> --model <name>'
            : 'Endpoint management:\n  /endpoint list                          Show registered endpoints\n  /endpoint add <name> <provider> <url> [apiKey]\n  /endpoint remove <name>\n\nExamples:\n  /endpoint add local ollama http://localhost:11434\n  /endpoint add openai-api openai https://api.openai.com/v1 sk-...\n  /endpoint add remote ollama http://192.168.1.100:11434\n\nOr from CLI:\n  hanimo --base-url <url> --api-key <key> --model <name>',
        );
        setMenuState('none');
        break;
      case 'clear':
        agent.clearMessages();
        agent.addSystemMessage('Conversation cleared.');
        setMenuState('none');
        break;
      case 'reset-config': {
        try {
          const configPath = joinPath(homedir(), '.hanimo', 'config.json');
          try { unlinkSync(configPath); } catch { /* already gone */ }
          console.log(ko
            ? '\n  ✅ 설정이 초기화되었습니다. hanimo를 재시작하면 온보딩이 시작됩니다.'
            : '\n  ✅ Config reset. Restart hanimo to run onboarding.',
          );
          process.exit(0);
        } catch (err: unknown) {
          agent.addSystemMessage(`❌ ${err instanceof Error ? err.message : String(err)}`);
        }
        setMenuState('none');
        break;
      }
      case 'help':
        if (commandCtxRef.current) handleCommand('/help', commandCtxRef.current);
        setMenuState('none');
        break;
      case 'exit':
        app.exit();
        break;
      default:
        setMenuState('none');
    }
  }, [agent, app, handleCommand, toggleTools]);

  const handleModelMenuSelect = useCallback((value: string) => {
    switchModel(value);
    setMenuState('none');
  }, [switchModel]);

  const handleProviderMenuSelect = useCallback((value: string) => {
    switchProvider(value);
    setMenuState('none');
  }, [switchProvider]);

  const handleLangMenuSelect = useCallback((value: string) => {
    setCurrentLang(value);
    const langNames: Record<string, string> = { ko: '한국어', en: 'English', auto: 'Auto' };
    agent.addSystemMessage(`Language set to ${langNames[value] ?? value}`);

    // Inject language instruction into next messages via system message
    if (value === 'ko') {
      agent.addSystemMessage('[System] 이후 모든 응답을 한국어로 해주세요.');
    } else if (value === 'en') {
      agent.addSystemMessage('[System] Respond in English from now on.');
    }
    setMenuState('none');
  }, [agent]);

  const handleMenuCancel = useCallback(() => {
    setMenuState('none');
  }, []);

  // Tab role cycling — silent (no system message, input bar shows mode)
  const cycleRole = useCallback(() => {
    if (!roleManager) return;
    const roles = roleManager.getAllRoles();
    if (roles.length === 0) return;
    const currentIdx = roles.findIndex((r) => r.id === currentRole?.id);
    const nextIdx = (currentIdx + 1) % roles.length;
    const role = roleManager.getRole(roles[nextIdx]?.id ?? '');
    if (!role) return;
    setCurrentRole(role);
    setCurrentTools(roleManager.createToolSet(role));
    setToolsEnabled(role.tools.length > 0);
    setCurrentSystemPrompt(buildSystemPrompt({ cwd: process.cwd(), platform: process.platform }, role));
  }, [roleManager, currentRole]);

  // Command palette items (respect language)
  const paletteItems: PaletteItem[] = useMemo(
    () => COMMAND_LIST.map((c) => ({ name: c.name, description: ko ? c.descriptionKo : c.description, shortcut: c.shortcut })),
    [ko],
  );

  const handlePaletteSelect = useCallback((name: string) => {
    setMenuState('none');
    if (commandCtxRef.current) handleCommand(`/${name}`, commandCtxRef.current);
  }, [handleCommand]);

  // Session menu items (refreshed when sessions menu opens)
  const sessionMenuItems: MenuItem[] = useMemo(() => {
    if (menuState !== 'sessions') return [];
    const sessions = sessionStoreRef.current.listSessions(10);
    if (sessions.length === 0) return [{ label: 'No saved sessions', value: '__none__' }];
    return sessions.map((s) => {
      const date = new Date(s.updatedAt).toLocaleString();
      return {
        label: `${s.provider}/${s.model} (${s.messageCount} msgs) ${date}`,
        value: s.id,
      };
    });
  }, [menuState]);

  const handleSessionSelect = useCallback((value: string) => {
    if (value === '__none__') {
      setMenuState('none');
      return;
    }
    const store = sessionStoreRef.current;
    const messages = store.getMessages(value);
    const displayMsgs = messages.map((m, i) => ({
      id: `loaded-${i}`,
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));
    agent.loadMessages(displayMsgs);
    const session = store.getSession(value);
    agent.addSystemMessage(`Session loaded: ${session?.provider}/${session?.model} (${messages.length} messages)`);
    setMenuState('none');
  }, [agent]);

  // Wait one tick for all initial state to settle before rendering
  if (!ready) return <Box />;

  return (
    <Box flexDirection="column" width="100%">
      {/* StatusBar removed — caused 4x duplicate rendering bug in Ink.
          Key info is shown in welcome screen + input bar instead. */}

      {showWelcome && agent.messages.length === 0 ? (
        <WelcomeScreen
          provider={currentProvider}
          model={currentModel}
          roleIcon={currentRole?.icon}
          roleName={currentRole?.name}
          cols={stdout?.columns ?? 80}
          height={chatHeight}
          themeId={currentThemeId}
        />
      ) : (
        <ChatView
          messages={agent.messages}
          streamingText={agent.streamingText}
          isLoading={agent.isLoading}
          height={chatHeight}
          verbose={verbose}
        />
      )}

      {/* Menus */}
      {menuState === 'main' && (
        <SelectMenu
          title="Menu"
          items={mainMenuItems}
          onSelect={handleMainMenuSelect}
          onCancel={handleMenuCancel}
        />
      )}
      {menuState === 'model' && (
        <SelectMenu
          title={`Models (${currentProvider})`}
          items={modelMenuItems}
          onSelect={handleModelMenuSelect}
          onCancel={handleMenuCancel}
          legend={ko
            ? '[A] 에이전트 (파일 편집, 셸, Git 전부 가능)  [R] 읽기 전용 (분석만)  [C] 대화만 (도구 없음)'
            : '[A] Agent (edit, shell, git — full tools)  [R] Read-only (analysis)  [C] Chat only (no tools)'}
        />
      )}
      {menuState === 'provider' && (
        <SelectMenu
          title="Providers"
          items={providerMenuItems}
          onSelect={handleProviderMenuSelect}
          onCancel={handleMenuCancel}
        />
      )}
      {menuState === 'lang' && (
        <SelectMenu
          title="Language"
          items={langMenuItems}
          onSelect={handleLangMenuSelect}
          onCancel={handleMenuCancel}
        />
      )}
      {menuState === 'role' && (
        <SelectMenu
          title="Role"
          items={roleMenuItems}
          onSelect={handleRoleMenuSelect}
          onCancel={handleMenuCancel}
        />
      )}
      {menuState === 'theme' && (
        <SelectMenu
          title={ko ? '테마 선택 (실시간 미리보기)' : 'Theme (live preview)'}
          items={themeMenuItems}
          onSelect={handleThemeMenuSelect}
          onCancel={handleThemeMenuCancel}
          onHighlight={handleThemeHighlight}
        />
      )}
      {menuState === 'palette' && (
        <CommandPalette
          items={paletteItems}
          onSelect={handlePaletteSelect}
          onCancel={handleMenuCancel}
          lang={currentLang}
        />
      )}
      {menuState === 'sessions' && (
        <SelectMenu
          title="Load Session"
          items={sessionMenuItems}
          onSelect={handleSessionSelect}
          onCancel={handleMenuCancel}
        />
      )}

      <InputBar
        onSubmit={handleInput}
        isDisabled={agent.isLoading}
        completions={completions}
        onCycleRole={cycleRole}
        roleIcon={currentRole?.icon}
        roleName={currentRole?.name}
      />

      <KeyHints
        isLoading={agent.isLoading}
        menuOpen={menuState !== 'none'}
        leaderActive={leader.leaderActive}
        lang={currentLang}
        statusInfo={(() => {
          const cwd = process.cwd().replace(process.env['HOME'] ?? '', '~');
          const tok = (agent.usage.promptTokens + agent.usage.completionTokens);
          const tokStr = tok >= 1000 ? `${(tok / 1000).toFixed(1)}k` : String(tok);
          const cost = agent.usage.totalCost === 0 ? '$0' : agent.usage.totalCost < 0.01 ? `$${agent.usage.totalCost.toFixed(4)}` : `$${agent.usage.totalCost.toFixed(2)}`;
          return `${cwd}  ${currentModel}  ${tokStr} tok  ${cost}`;
        })()}
      />
    </Box>
  );
}

export interface StartAppOptions {
  provider: string;
  model: string;
  modelInstance: LanguageModelV1;
  systemPrompt: string;
  tools?: ToolSet;
  maxSteps?: number;
  initialPrompt?: string;
  providerConfig?: { apiKey?: string; baseURL?: string };
  roleManager?: RoleManager;
  activeRole?: RoleDefinition;
  networkMode?: string;
  streaming?: boolean;
}

export function startApp(options: StartAppOptions): void {
  // Enter alternate screen buffer (prevents scrollback pollution)
  process.stdout.write('\x1B[?1049h');
  // Clear alternate screen and move cursor to top-left
  process.stdout.write('\x1B[2J\x1B[H');
  // Hide cursor (Ink manages its own cursor)
  process.stdout.write('\x1B[?25l');

  const instance = render(
    <ErrorBoundary>
      <App
        provider={options.provider}
        model={options.model}
        modelInstance={options.modelInstance}
        systemPrompt={options.systemPrompt}
        tools={options.tools}
        initialPrompt={options.initialPrompt}
        providerConfig={options.providerConfig}
        roleManager={options.roleManager}
        activeRole={options.activeRole}
        streaming={options.streaming}
      />
    </ErrorBoundary>,
    { exitOnCtrlC: false, patchConsole: true },
  );

  // Ensure process exits when Ink unmounts
  instance.waitUntilExit().then(() => {
    // Restore: show cursor + leave alternate screen buffer
    process.stdout.write('\x1B[?25h\x1B[?1049l');
    // Print session summary
    if (sessionStatsSnapshot) {
      sessionStatsSnapshot.wallTimeMs = Date.now() - sessionStartTime;
      printExitSummary(sessionStatsSnapshot);
    }
    process.exit(0);
  }).catch(() => {
    process.stdout.write('\x1B[?25h\x1B[?1049l');
    if (sessionStatsSnapshot) {
      sessionStatsSnapshot.wallTimeMs = Date.now() - sessionStartTime;
      printExitSummary(sessionStatsSnapshot);
    }
    process.exit(1);
  });
}

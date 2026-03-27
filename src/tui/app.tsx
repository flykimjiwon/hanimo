import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { render, Box, Text, useApp, useInput, useStdout } from 'ink';
import type { LanguageModelV1, ToolSet } from 'ai';
import { StatusBar } from './components/status-bar.js';
import { ChatView } from './components/chat-view.js';
import { InputBar } from './components/input-bar.js';
import { SelectMenu } from './components/select-menu.js';
import type { MenuItem } from './components/select-menu.js';
import { useAgent } from './hooks/use-agent.js';
import { useCommands, COMMAND_NAMES } from './hooks/use-commands.js';
import type { CommandContext } from './hooks/use-commands.js';
import { colors } from './theme.js';
import { LOCAL_PROVIDERS, KNOWN_MODELS, PROVIDER_NAMES } from '../providers/types.js';
import type { ProviderName } from '../providers/types.js';
import { getModel, clearProviderCache } from '../providers/registry.js';
import { getModelCapability, ROLE_BADGES } from '../providers/model-capabilities.js';
import type { ModelRole } from '../providers/model-capabilities.js';
import { createReadOnlyTools } from '../tools/registry.js';

type MenuState = 'none' | 'main' | 'model' | 'provider';

interface AppProps {
  provider: string;
  model: string;
  modelInstance: LanguageModelV1;
  systemPrompt: string;
  tools?: ToolSet;
  initialPrompt?: string;
  providerConfig?: { apiKey?: string; baseURL?: string };
}

function KeyHints({ isLoading, menuOpen }: { isLoading: boolean; menuOpen: boolean }): React.ReactElement {
  if (menuOpen) return <Box width="100%" paddingX={1} justifyContent="center"><Text color={colors.hint}>{'Esc close menu'}</Text></Box>;
  return (
    <Box width="100%" paddingX={1} justifyContent="center">
      <Text color={colors.hint}>
        {isLoading
          ? 'Ctrl+C cancel  |  Ctrl+C Ctrl+C exit'
          : 'Enter send  |  Esc menu  |  Ctrl+C exit  |  /help commands'}
      </Text>
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
}: AppProps): React.ReactElement {
  const app = useApp();
  const { stdout } = useStdout();

  // Dynamic provider/model state
  const [currentProvider, setCurrentProvider] = useState(initialProvider);
  const [currentModel, setCurrentModel] = useState(initialModel);
  const [termRows, setTermRows] = useState(stdout?.rows ?? 24);
  const [menuState, setMenuState] = useState<MenuState>('none');

  // Role-based capability detection
  const initialCap = getModelCapability(initialModel, initialProvider);
  const [modelRole, setModelRole] = useState<ModelRole>(initialCap.role);
  const [toolsEnabled, setToolsEnabled] = useState(initialCap.role !== 'chat');

  // Determine effective tools based on role
  const effectiveTools = useMemo(() => {
    if (!toolsEnabled) return undefined;
    if (modelRole === 'agent') return tools;
    if (modelRole === 'assistant') return createReadOnlyTools() as ToolSet;
    return undefined; // chat
  }, [toolsEnabled, modelRole, tools]);

  const agent = useAgent({
    model: modelInstance,
    systemPrompt,
    tools: effectiveTools,
  });

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

  const switchModel = useCallback((name: string) => {
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
      agent.addSystemMessage(`Model switched to ${name} ${badge}${toolsNote}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      agent.addSystemMessage(`Failed to switch model: ${msg}`);
    }
  }, [agent, providerConfig]);

  const switchProvider = useCallback((name: string) => {
    try {
      clearProviderCache();
      const isLocal = LOCAL_PROVIDERS.has(name as ProviderName);
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
      agent.addSystemMessage(`Provider switched to ${name}/${defaultModel} ${badge}`);
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
  };

  // Input handler: routes to commands or sends as message
  const handleInput = useCallback((text: string) => {
    if (!commandCtxRef.current) return;
    const result = handleCommand(text, commandCtxRef.current);
    if (!result.handled) {
      agent.sendMessage(text);
    }
  }, [agent, handleCommand]);

  // Esc key + Ctrl+C handling
  useInput(useCallback((_input: string, key: { ctrl: boolean; escape: boolean }) => {
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

  const status = agent.currentTool
    ? ('tool' as const)
    : agent.isLoading
      ? ('thinking' as const)
      : ('idle' as const);

  // Calculate height: status bar (2) + input (3) + hints (1) + padding (1) = 7
  // When menu is open, reserve extra space for the menu
  const menuHeight = menuState !== 'none' ? 12 : 0;
  const chatHeight = Math.max(termRows - 7 - menuHeight, 5);

  // Tab completions: slash commands + current provider's model names
  const completions = useMemo(() => {
    const cmds = COMMAND_NAMES.map((c) => `/${c}`);
    const models = KNOWN_MODELS[currentProvider] ?? [];
    return [...cmds, ...models];
  }, [currentProvider]);

  // Menu items
  const mainMenuItems: MenuItem[] = [
    { label: 'Switch Model', value: 'model' },
    { label: 'Switch Provider', value: 'provider' },
    { label: `Tools: ${toolsEnabled ? 'ON → OFF' : 'OFF → ON'}`, value: 'tools' },
    { label: 'Clear Conversation', value: 'clear' },
    { label: 'Help', value: 'help' },
    { label: 'Exit', value: 'exit' },
  ];

  const modelMenuItems: MenuItem[] = useMemo(() => {
    const models = KNOWN_MODELS[currentProvider] ?? [];
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
  }, [currentProvider, currentModel]);

  const providerMenuItems: MenuItem[] = useMemo(() => {
    return PROVIDER_NAMES.map((p) => ({
      label: p,
      value: p,
      active: p === currentProvider,
    }));
  }, [currentProvider]);

  const handleMainMenuSelect = useCallback((value: string) => {
    switch (value) {
      case 'model':
        setMenuState('model');
        break;
      case 'provider':
        setMenuState('provider');
        break;
      case 'tools':
        toggleTools();
        setMenuState('none');
        break;
      case 'clear':
        agent.clearMessages();
        agent.addSystemMessage('Conversation cleared.');
        setMenuState('none');
        break;
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

  const handleMenuCancel = useCallback(() => {
    setMenuState('none');
  }, []);

  return (
    <Box flexDirection="column" width="100%">
      <StatusBar
        provider={currentProvider}
        model={currentModel}
        modelRole={modelRole}
        status={status}
        currentTool={agent.currentTool ?? undefined}
        toolsEnabled={toolsEnabled}
        usage={agent.usage}
      />

      <ChatView
        messages={agent.messages}
        streamingText={agent.streamingText}
        isLoading={agent.isLoading}
        height={chatHeight}
      />

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

      <InputBar
        onSubmit={handleInput}
        isDisabled={agent.isLoading}
        completions={completions}
      />

      <KeyHints isLoading={agent.isLoading} menuOpen={menuState !== 'none'} />
    </Box>
  );
}

export interface StartAppOptions {
  provider: string;
  model: string;
  modelInstance: LanguageModelV1;
  systemPrompt: string;
  tools?: ToolSet;
  initialPrompt?: string;
  providerConfig?: { apiKey?: string; baseURL?: string };
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
      />
    </ErrorBoundary>,
    { exitOnCtrlC: false, patchConsole: true },
  );

  // Ensure process exits when Ink unmounts
  instance.waitUntilExit().then(() => {
    // Restore: show cursor + leave alternate screen buffer
    process.stdout.write('\x1B[?25h\x1B[?1049l');
    process.exit(0);
  }).catch(() => {
    process.stdout.write('\x1B[?25h\x1B[?1049l');
    process.exit(1);
  });
}

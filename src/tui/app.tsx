import React, { useEffect, useCallback, useState } from 'react';
import { render, Box, Text, useApp, useInput, useStdout } from 'ink';
import type { LanguageModelV1, ToolSet } from 'ai';
import { StatusBar } from './components/status-bar.js';
import { ChatView } from './components/chat-view.js';
import { InputBar } from './components/input-bar.js';
import { useAgent } from './hooks/use-agent.js';
import { colors } from './theme.js';
import { LOCAL_PROVIDERS } from '../providers/types.js';
import type { ProviderName } from '../providers/types.js';

interface AppProps {
  provider: string;
  model: string;
  modelInstance: LanguageModelV1;
  systemPrompt: string;
  tools?: ToolSet;
  initialPrompt?: string;
}

function KeyHints({ isLoading }: { isLoading: boolean }): React.ReactElement {
  return (
    <Box width="100%" paddingX={1} justifyContent="center">
      <Text color={colors.hint}>
        {isLoading
          ? 'Ctrl+C cancel  |  Ctrl+C Ctrl+C exit'
          : 'Enter send  |  Ctrl+C exit  |  /help commands'}
      </Text>
    </Box>
  );
}

function App({
  provider,
  model,
  modelInstance,
  systemPrompt,
  tools,
  initialPrompt,
}: AppProps): React.ReactElement {
  const app = useApp();
  const { stdout } = useStdout();
  const [toolsEnabled] = useState(!LOCAL_PROVIDERS.has(provider as ProviderName));

  const agent = useAgent({
    model: modelInstance,
    systemPrompt,
    tools: toolsEnabled ? tools : undefined,
  });

  // Handle Ctrl+C to exit — double-tap Ctrl+C always exits
  const ctrlCCountRef = React.useRef(0);
  const ctrlCTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useInput(useCallback((_input: string, key: { ctrl: boolean }) => {
    if (key.ctrl && _input === 'c') {
      ctrlCCountRef.current++;

      if (agent.isLoading) {
        agent.cancelRun();
      }

      // Double Ctrl+C always exits
      if (ctrlCCountRef.current >= 2) {
        app.exit();
        process.exit(0);
      }

      // Reset counter after 1 second
      if (ctrlCTimerRef.current) clearTimeout(ctrlCTimerRef.current);
      ctrlCTimerRef.current = setTimeout(() => {
        ctrlCCountRef.current = 0;
      }, 1000);

      // Single Ctrl+C when idle also exits
      if (!agent.isLoading) {
        app.exit();
        process.exit(0);
      }
    }
  }, [agent, app]));

  // Send initial prompt on mount
  useEffect(() => {
    if (initialPrompt && initialPrompt.length > 0) {
      agent.sendMessage(initialPrompt);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const status = agent.currentTool
    ? ('tool' as const)
    : agent.isLoading
      ? ('thinking' as const)
      : ('idle' as const);

  // Calculate height: leave room for status bar (2) + input (3) + hints (1)
  const rows = stdout?.rows ?? 24;
  const chatHeight = Math.max(rows - 7, 5);

  return (
    <Box flexDirection="column" width="100%">
      <StatusBar
        provider={provider}
        model={model}
        status={status}
        currentTool={agent.currentTool ?? undefined}
        toolsEnabled={toolsEnabled}
        usage={agent.usage}
      />

      <Box height={chatHeight}>
        <ChatView
          messages={agent.messages}
          streamingText={agent.streamingText}
          isLoading={agent.isLoading}
        />
      </Box>

      <InputBar
        onSubmit={agent.sendMessage}
        isDisabled={agent.isLoading}
      />

      <KeyHints isLoading={agent.isLoading} />
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
}

export function startApp(options: StartAppOptions): void {
  // Clear screen before starting
  process.stdout.write('\x1B[2J\x1B[H');

  const instance = render(
    <App
      provider={options.provider}
      model={options.model}
      modelInstance={options.modelInstance}
      systemPrompt={options.systemPrompt}
      tools={options.tools}
      initialPrompt={options.initialPrompt}
    />,
    { exitOnCtrlC: false },
  );

  // Ensure process exits when Ink unmounts
  instance.waitUntilExit().then(() => {
    process.exit(0);
  });
}

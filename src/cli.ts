import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { SessionStore } from './session/store.js';
import { getModel, registerCustomProviders, getModelForCustomProvider, getCustomProviderNames } from './providers/registry.js';
import { buildSystemPrompt } from './core/system-prompt.js';
import { createToolRegistry, mergeToolSets } from './tools/registry.js';
import { startTextMode } from './text-mode.js';
import { needsOnboarding, runOnboarding } from './onboarding.js';
import type { ProviderName } from './providers/types.js';
import { RoleManager } from './roles/role-manager.js';
import { McpBridge } from './mcp/bridge.js';
import { detectNetworkMode } from './mcp/network.js';

export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('modol')
    .description('Terminal-based multi-agent AI coding system')
    .version('0.1.0')
    .argument('[prompt...]', 'Initial prompt')
    .option('-p, --provider <name>', 'LLM provider')
    .option('-m, --model <name>', 'Model name')
    .option('-k, --api-key <key>', 'API key (overrides config/env)')
    .option('-u, --base-url <url>', 'Base URL (OpenAI-compatible endpoint)')
    .option('-w, --workers <n>', 'Number of parallel workers', parseInt)
    .option('--resume [sessionId]', 'Resume a session')
    .option('--text', 'Use lightweight text mode (default is TUI)')
    .option('--tui', 'Use fullscreen TUI mode (default)')
    .option('--role <id>', 'Active role (chat, dev, plan, or custom)')
    .option('--offline', 'Force offline mode (disable online-only MCP servers)')
    .option('--list-sessions', 'List saved sessions')
    .option('--setup', 'Re-run initial setup')
    .option('--share-config [file]', 'Export shareable config (default: modol-shared.json)')
    .option('--import-config <file>', 'Import a shared config file')
    .action(async (promptParts: string[], options: {
      provider?: string;
      model?: string;
      apiKey?: string;
      baseUrl?: string;
      workers?: number;
      resume?: string | boolean;
      text?: boolean;
      role?: string;
      offline?: boolean;
      listSessions?: boolean;
      setup?: boolean;
      shareConfig?: string | boolean;
      importConfig?: string;
    }) => {
      // --share-config: export shareable config
      if (options.shareConfig !== undefined) {
        const { readFileSync, writeFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        const { homedir } = await import('node:os');
        const configPath = join(homedir(), '.modol', 'config.json');
        let cfg: Record<string, unknown> = {};
        try { cfg = JSON.parse(readFileSync(configPath, 'utf-8')); } catch { /* empty */ }
        // Strip sensitive keys for sharing
        const shared = { ...cfg };
        if (shared['providers']) {
          const providers = { ...(shared['providers'] as Record<string, Record<string, unknown>>) };
          const localProviders = new Set(['ollama', 'vllm', 'lmstudio', 'custom']);
          for (const [k, v] of Object.entries(providers)) {
            if (localProviders.has(k) || !v.apiKey) {
              // Local providers don't need API keys — keep as-is
              providers[k] = { ...v };
            } else {
              const { apiKey: _a, ...rest } = v;
              providers[k] = { ...rest, apiKey: '<YOUR_API_KEY>' };
            }
          }
          shared['providers'] = providers;
        }
        const outFile = typeof options.shareConfig === 'string' ? options.shareConfig : 'modol-shared.json';
        writeFileSync(outFile, JSON.stringify(shared, null, 2) + '\n');
        console.log(`✅ Shared config exported: ${outFile}`);
        console.log('   API keys are replaced with placeholders.');
        console.log('   Share this file — recipients run: modol --import-config ' + outFile);
        return;
      }

      // --import-config: import shared config
      if (options.importConfig) {
        const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs');
        const { join } = await import('node:path');
        const { homedir } = await import('node:os');
        try {
          const imported = JSON.parse(readFileSync(options.importConfig, 'utf-8'));
          const configDir = join(homedir(), '.modol');
          mkdirSync(configDir, { recursive: true });
          writeFileSync(join(configDir, 'config.json'), JSON.stringify(imported, null, 2) + '\n', { mode: 0o600 });
          console.log(`✅ Config imported from ${options.importConfig}`);
          console.log('   Edit ~/.modol/config.json to add your API keys.');
          console.log('   Then run: modol');
        } catch (err: unknown) {
          console.error(`❌ Failed to import: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }

      // First-run onboarding or explicit --setup
      if (options.setup || await needsOnboarding()) {
        await runOnboarding();
      }

      const config = await loadConfig();

      // Register custom providers from config
      if (config.customProviders.length > 0) {
        registerCustomProviders(config.customProviders);
      }

      // Apply CLI overrides (highest priority)
      if (options.provider) {
        config.provider = options.provider as typeof config.provider;
      }
      if (options.model) {
        config.model = options.model;
      }
      if (options.workers) {
        config.maxWorkers = options.workers;
      }

      // --base-url without --provider → auto custom
      if (options.baseUrl && !options.provider) {
        config.provider = 'custom';
      }

      // Merge CLI --api-key / --base-url into provider config
      if (options.apiKey || options.baseUrl) {
        const p = config.provider;
        config.providers = config.providers ?? {};
        config.providers[p] = {
          ...config.providers[p],
          ...(options.apiKey ? { apiKey: options.apiKey } : {}),
          ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
        };
      }

      const prompt = promptParts.join(' ');

      // List sessions mode
      if (options.listSessions) {
        const store = new SessionStore();
        const sessions = store.listSessions(20);
        store.close();

        if (sessions.length === 0) {
          console.log('No saved sessions.');
          return;
        }

        console.log('Recent sessions:\n');
        for (const s of sessions) {
          const date = s.updatedAt.replace('T', ' ').slice(0, 19);
          console.log(
            `  ${s.id.slice(0, 8)}  ${date}  ${s.provider}/${s.model}  (${s.messageCount} msgs)`,
          );
        }
        return;
      }

      // Resume session mode
      let resumeSession: { sessionId: string; messages: Array<{ role: string; content: string }> } | undefined;

      if (options.resume !== undefined) {
        const store = new SessionStore();

        if (options.resume === true || options.resume === '') {
          // --resume without ID → pick latest session
          const sessions = store.listSessions(1);
          if (sessions.length === 0) {
            console.log('No sessions to resume. Start a new conversation.');
            store.close();
            return;
          }
          const latest = sessions[0]!;
          const msgs = store.getMessages(latest.id);
          resumeSession = {
            sessionId: latest.id,
            messages: msgs.map(m => ({ role: m.role, content: m.content })),
          };
          // Use session's provider/model as defaults (CLI flags still override)
          if (!options.provider) config.provider = latest.provider as typeof config.provider;
          if (!options.model) config.model = latest.model;
          console.log(`Resuming session ${latest.id.slice(0, 8)} (${msgs.length} messages)`);
        } else {
          // --resume <sessionId> or partial ID
          const sessionId = String(options.resume);
          const sessions = store.listSessions();
          const match = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));
          if (!match) {
            console.log(`Session not found: ${sessionId}`);
            console.log('Use --list-sessions to see available sessions.');
            store.close();
            return;
          }
          const msgs = store.getMessages(match.id);
          resumeSession = {
            sessionId: match.id,
            messages: msgs.map(m => ({ role: m.role, content: m.content })),
          };
          if (!options.provider) config.provider = match.provider as typeof config.provider;
          if (!options.model) config.model = match.model;
          console.log(`Resuming session ${match.id.slice(0, 8)} (${msgs.length} messages)`);
        }
        store.close();
      }

      // Initialize role system
      const roleManager = new RoleManager();
      await roleManager.loadCustomRoles();

      const roleId = options.role ?? config.defaultRole;
      const activeRole = roleManager.getRole(roleId);
      if (!activeRole) {
        const available = roleManager.getAllRoles().map(r => r.id).join(', ');
        console.error(`Unknown role: "${roleId}". Available: ${available}`);
        process.exit(1);
      }

      // Apply role maxSteps if not overridden by config
      const maxSteps = activeRole.maxSteps;

      // Prepare model + tools
      const providerConfig = config.providers?.[config.provider] ?? {};
      const customProviderNames = getCustomProviderNames();
      const modelInstance = customProviderNames.includes(config.provider)
        ? getModelForCustomProvider(config.provider, config.model)!
        : getModel(config.provider as ProviderName, config.model, providerConfig);
      const systemPrompt = buildSystemPrompt({
        cwd: process.cwd(),
        platform: process.platform,
      }, activeRole);
      const tools = roleManager.createToolSet(activeRole) ?? createToolRegistry();

      const networkMode = options.offline ? 'offline' as const : config.network.mode;

      // MCP: connect configured servers and merge their tools
      const mcpBridge = new McpBridge();
      const mcpServers = config.mcp?.servers ?? {};
      if (Object.keys(mcpServers).length > 0) {
        try {
          const resolvedNetwork = await detectNetworkMode(networkMode as 'auto' | 'online' | 'offline');
          await mcpBridge.loadFromConfig(mcpServers);
          const mcpTools = mcpBridge.getAvailableTools(resolvedNetwork);
          if (mcpTools) {
            const merged = mergeToolSets(tools, mcpTools);
            if (merged) Object.assign(tools, merged);
          }
          const count = mcpBridge.getConnectedCount();
          if (count > 0) {
            console.log(`[MCP] ${count} server(s) connected`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[MCP] Failed to initialize: ${msg}`);
        }
      }

      // Cleanup MCP on exit
      process.on('exit', () => { mcpBridge.disconnectAll().catch(() => {}); });

      if (options.text) {
        // Text mode: lightweight readline-based interactive loop
        await startTextMode({
          provider: config.provider,
          model: config.model,
          modelInstance,
          systemPrompt,
          tools,
          maxSteps,
          initialPrompt: prompt || undefined,
          resumeSession,
          roleManager,
          activeRole,
          networkMode,
        });
        return;
      }

      // Default: TUI mode (fullscreen Ink app)
      // Falls back to text mode if TUI dependencies are unavailable (e.g. binary build)
      try {
        const { startApp } = await import('./tui/app.js');
        startApp({
          provider: config.provider,
          model: config.model,
          modelInstance,
          systemPrompt,
          tools,
          maxSteps,
          initialPrompt: prompt || undefined,
          providerConfig,
          roleManager,
          activeRole,
          networkMode,
        });
      } catch {
        console.log('[TUI unavailable — falling back to text mode]');
        await startTextMode({
          provider: config.provider,
          model: config.model,
          modelInstance,
          systemPrompt,
          tools,
          maxSteps,
          initialPrompt: prompt || undefined,
          resumeSession,
          roleManager,
          activeRole,
          networkMode,
        });
      }
    });

  program.parse();
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

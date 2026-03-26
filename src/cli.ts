import { Command } from 'commander';
import { loadConfig } from './config/loader.js';
import { SessionStore } from './session/store.js';
import { getModel } from './providers/registry.js';
import { buildSystemPrompt } from './core/system-prompt.js';
import { createToolRegistry } from './tools/registry.js';
import { startTextMode } from './text-mode.js';
import { needsOnboarding, runOnboarding } from './onboarding.js';
import type { ProviderName } from './providers/types.js';

export async function main(): Promise<void> {
  const program = new Command();

  program
    .name('devany')
    .description('Terminal-based multi-agent AI coding system')
    .version('0.1.0')
    .argument('[prompt...]', 'Initial prompt')
    .option('-p, --provider <name>', 'LLM provider')
    .option('-m, --model <name>', 'Model name')
    .option('-w, --workers <n>', 'Number of parallel workers', parseInt)
    .option('--resume [sessionId]', 'Resume a session')
    .option('--tui', 'Enable fullscreen TUI mode')
    .option('--list-sessions', 'List saved sessions')
    .option('--setup', 'Re-run initial setup')
    .action(async (promptParts: string[], options: {
      provider?: string;
      model?: string;
      workers?: number;
      resume?: string | boolean;
      tui?: boolean;
      listSessions?: boolean;
      setup?: boolean;
    }) => {
      // First-run onboarding or explicit --setup
      if (options.setup || await needsOnboarding()) {
        await runOnboarding();
      }

      const config = await loadConfig();

      // Apply CLI overrides
      if (options.provider) {
        config.provider = options.provider as typeof config.provider;
      }
      if (options.model) {
        config.model = options.model;
      }
      if (options.workers) {
        config.maxWorkers = options.workers;
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
          console.log(
            `  ${s.id.slice(0, 8)}  ${s.updatedAt}  ${s.provider}/${s.model}  (${s.messageCount} msgs)`,
          );
        }
        return;
      }

      // Prepare model + tools
      const providerConfig = config.providers?.[config.provider] ?? {};
      const modelInstance = getModel(
        config.provider as ProviderName,
        config.model,
        providerConfig,
      );
      const systemPrompt = buildSystemPrompt({
        cwd: process.cwd(),
        platform: process.platform,
      });
      const tools = createToolRegistry();

      if (options.tui) {
        // TUI mode: launch fullscreen Ink app
        const { startApp } = await import('./tui/app.js');
        startApp({
          provider: config.provider,
          model: config.model,
          modelInstance,
          systemPrompt,
          tools,
          initialPrompt: prompt || undefined,
        });
        return;
      }

      // Default: text mode (readline-based interactive loop)
      await startTextMode({
        provider: config.provider,
        model: config.model,
        modelInstance,
        systemPrompt,
        tools,
        initialPrompt: prompt || undefined,
      });
    });

  program.parse();
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

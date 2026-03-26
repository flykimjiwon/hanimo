import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LanguageModelV1, ToolSet } from 'ai';
import { runAgentLoop } from './core/agent-loop.js';
import { getModel, clearProviderCache } from './providers/registry.js';
import { loadConfig } from './config/loader.js';
import { PROVIDER_NAMES } from './providers/types.js';
import type { ProviderName } from './providers/types.js';
import type { Message, AgentEvent, TokenUsage } from './core/types.js';

const execFileAsync = promisify(execFile);

const LOCAL_PROVIDERS = new Set(['ollama', 'vllm', 'custom']);

// ANSI colors
const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string): string => `\x1b[36m${s}\x1b[0m`;
const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`;
const red = (s: string): string => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;

interface TextModeOptions {
  provider: string;
  model: string;
  modelInstance: LanguageModelV1;
  systemPrompt: string;
  tools: ToolSet;
  initialPrompt?: string;
}

async function listOllamaModels(): Promise<string[]> {
  try {
    const { stdout: output } = await execFileAsync('ollama', ['list'], { timeout: 10000 });
    const lines = output.trim().split('\n');
    if (lines.length <= 1) return [];
    const models: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.trim().split(/\s{2,}/);
      const name = parts[0];
      if (name) models.push(name);
    }
    return models;
  } catch {
    return [];
  }
}

export async function startTextMode(options: TextModeOptions): Promise<void> {
  let currentProvider = options.provider;
  let currentModel = options.model;
  let currentModelInstance = options.modelInstance;
  const { systemPrompt, tools, initialPrompt } = options;

  // Local providers (Ollama etc.) don't support tool calling by default
  let toolsEnabled = !LOCAL_PROVIDERS.has(currentProvider);

  const messages: Message[] = [];
  const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  function printBanner(): void {
    console.log();
    console.log(`  ${bold('devany')} v0.1.0  ${dim('(')}${green(currentProvider)}${dim('/')}${cyan(currentModel)}${dim(')')}`);
    console.log(`  ${dim('종료: Ctrl+C  |  /help 로 명령어 보기')}`);
    console.log(dim('─'.repeat(50)));
    console.log();
  }

  printBanner();

  const rl = createInterface({ input: stdin, output: stdout });

  let isRunning = false;
  let abortController: AbortController | null = null;

  // Ctrl+C handling
  process.on('SIGINT', () => {
    if (isRunning && abortController) {
      abortController.abort();
      console.log(`\n  ${dim('(취소됨)')}`);
      isRunning = false;
      abortController = null;
    } else {
      console.log('\n  Bye!');
      rl.close();
      process.exit(0);
    }
  });

  async function switchModel(newModel: string): Promise<boolean> {
    try {
      const config = await loadConfig();
      const providerConfig = config.providers?.[currentProvider] ?? {};
      clearProviderCache();
      currentModelInstance = getModel(
        currentProvider as ProviderName,
        newModel,
        providerConfig,
      );
      currentModel = newModel;
      console.log(`  ${green('✓')} 모델 변경: ${cyan(newModel)}`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${red('✗')} 모델 변경 실패: ${msg}`);
      return false;
    }
  }

  async function switchProvider(newProvider: string, newModel?: string): Promise<boolean> {
    if (!PROVIDER_NAMES.includes(newProvider as ProviderName)) {
      console.log(`  ${red('✗')} 알 수 없는 프로바이더: ${newProvider}`);
      console.log(`  ${dim('사용 가능:')} ${PROVIDER_NAMES.join(', ')}`);
      return false;
    }
    try {
      const config = await loadConfig();
      const providerConfig = config.providers?.[newProvider] ?? {};
      const modelId = newModel ?? config.model;
      clearProviderCache();
      currentModelInstance = getModel(
        newProvider as ProviderName,
        modelId,
        providerConfig,
      );
      currentProvider = newProvider;
      currentModel = modelId;
      toolsEnabled = !LOCAL_PROVIDERS.has(newProvider);
      console.log(`  ${green('✓')} 프로바이더 변경: ${green(newProvider)}/${cyan(modelId)}`);
      console.log(`  ${dim('도구:')} ${toolsEnabled ? green('ON') : red('OFF')} ${dim('(/tools 로 토글)')}`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${red('✗')} 프로바이더 변경 실패: ${msg}`);
      return false;
    }
  }

  async function handleInput(input: string): Promise<boolean> {
    const trimmed = input.trim();
    if (!trimmed) return true;

    // Slash commands
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);
      switch (cmd) {
        case 'help':
        case 'h':
          console.log();
          console.log(`  ${bold('명령어:')}`);
          console.log(`    ${cyan('/help')}                  도움말`);
          console.log(`    ${cyan('/model')} <name>          모델 변경 (즉시 적용)`);
          console.log(`    ${cyan('/models')}                사용 가능한 모델 목록`);
          console.log(`    ${cyan('/provider')} <name>       프로바이더 변경`);
          console.log(`    ${cyan('/providers')}             프로바이더 목록`);
          console.log(`    ${cyan('/tools')}                 도구 사용 토글 (on/off)`);
          console.log(`    ${cyan('/config')}                현재 설정 보기`);
          console.log(`    ${cyan('/usage')}                 토큰 사용량`);
          console.log(`    ${cyan('/clear')}                 대화 초기화`);
          console.log(`    ${cyan('/exit')}                  종료`);
          console.log();
          return true;

        case 'model':
        case 'm':
          if (args.length > 0) {
            await switchModel(args.join(' '));
          } else {
            console.log(`  현재 모델: ${cyan(currentModel)}`);
            console.log(`  ${dim('변경: /model <name>')}`);
          }
          return true;

        case 'models':
          if (currentProvider === 'ollama') {
            console.log(`  ${dim('Ollama 모델 조회 중...')}`);
            const models = await listOllamaModels();
            if (models.length > 0) {
              console.log();
              for (const [i, m] of models.entries()) {
                const marker = m === currentModel ? green(' ●') : '  ';
                console.log(`  ${marker} ${i + 1}) ${m}`);
              }
              console.log();
              console.log(`  ${dim('/model <name> 으로 변경')}`);
            } else {
              console.log(`  ${red('모델 없음')} — ollama pull <model> 로 설치하세요.`);
            }
          } else {
            console.log(`  ${dim('모델 목록은 Ollama에서만 자동 조회됩니다.')}`);
            console.log(`  ${dim('/model <name> 으로 직접 변경하세요.')}`);
          }
          console.log();
          return true;

        case 'provider':
        case 'p':
          if (args.length > 0) {
            const newProvider = args[0] ?? '';
            await switchProvider(newProvider, args[1]);
          } else {
            console.log(`  현재 프로바이더: ${green(currentProvider)}`);
            console.log(`  ${dim('변경: /provider <name> [model]')}`);
          }
          return true;

        case 'providers':
          console.log();
          for (const p of PROVIDER_NAMES) {
            const marker = p === currentProvider ? green(' ●') : '  ';
            console.log(`  ${marker} ${p}`);
          }
          console.log();
          console.log(`  ${dim('/provider <name> 으로 변경')}`);
          console.log();
          return true;

        case 'tools':
        case 't': {
          const arg = args[0]?.toLowerCase();
          if (arg === 'on') {
            toolsEnabled = true;
            console.log(`  ${green('✓')} 도구 사용 ${green('ON')} — 모델이 tool calling을 지원해야 합니다.`);
          } else if (arg === 'off') {
            toolsEnabled = false;
            console.log(`  ${green('✓')} 도구 사용 ${red('OFF')} — 순수 대화 모드`);
          } else {
            toolsEnabled = !toolsEnabled;
            console.log(`  ${green('✓')} 도구 사용 ${toolsEnabled ? green('ON') : red('OFF')}`);
          }
          return true;
        }

        case 'config':
          console.log();
          console.log(`  ${bold('현재 설정:')}`);
          console.log(`    프로바이더: ${green(currentProvider)}`);
          console.log(`    모델:       ${cyan(currentModel)}`);
          console.log(`    도구:       ${toolsEnabled ? green('ON') : red('OFF')} ${dim('(/tools 로 토글)')}`);
          console.log(`    대화:       ${messages.length}개 메시지`);
          console.log(`    토큰:       ${totalUsage.totalTokens.toLocaleString()}`);
          console.log();
          return true;

        case 'usage':
        case 'u':
          console.log();
          console.log(`  ${bold('토큰 사용량:')}`);
          console.log(`    prompt:     ${totalUsage.promptTokens.toLocaleString()}`);
          console.log(`    completion: ${totalUsage.completionTokens.toLocaleString()}`);
          console.log(`    total:      ${totalUsage.totalTokens.toLocaleString()}`);
          console.log(`    대화:       ${messages.length}개 메시지`);
          console.log();
          return true;

        case 'clear':
          messages.length = 0;
          console.log(`  ${green('✓')} 대화 초기화됨.`);
          return true;

        case 'exit':
        case 'quit':
        case 'q':
          return false;

        default:
          console.log(`  ${dim('알 수 없는 명령어:')} /${cmd ?? ''} ${dim('— /help 참고')}`);
          return true;
      }
    }

    // Regular message — send to agent
    messages.push({ role: 'user', content: trimmed });
    isRunning = true;
    abortController = new AbortController();

    // AI response marker
    process.stdout.write(`\n  ${cyan('▌')} `);

    const onEvent = (event: AgentEvent): void => {
      switch (event.type) {
        case 'token':
          process.stdout.write(event.content);
          break;
        case 'tool-call':
          process.stdout.write(`\n  ${yellow('⚡')} ${dim(event.toolName + '...')}`);
          break;
        case 'tool-result': {
          const preview = event.result.length > 200
            ? event.result.slice(0, 200) + '...'
            : event.result;
          const lines = preview.split('\n').slice(0, 5);
          process.stdout.write(`\n  ${dim('┃')} ${dim(lines.join('\n  ┃ '))}\n  ${cyan('▌')} `);
          break;
        }
        case 'done':
          totalUsage.promptTokens += event.usage.promptTokens;
          totalUsage.completionTokens += event.usage.completionTokens;
          totalUsage.totalTokens += event.usage.totalTokens;
          break;
        case 'error':
          process.stdout.write(`\n  ${red('✗')} ${event.error.message}`);
          break;
      }
    };

    try {
      const result = await runAgentLoop({
        model: currentModelInstance,
        systemPrompt,
        messages,
        tools: toolsEnabled ? tools : undefined,
        maxSteps: toolsEnabled ? 25 : 1,
        onEvent,
        abortSignal: abortController.signal,
      });

      if (result.response) {
        messages.push({ role: 'assistant', content: result.response });
      } else {
        console.log(`\n  ${yellow('⚠')} 빈 응답 — 모델 연결을 확인하세요.`);
        if (currentProvider === 'ollama') {
          console.log(`  ${dim('ollama ps 로 모델 로드 상태 확인 | /models 로 목록 보기')}`);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled — already printed
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n  ${red('✗')} ${msg}`);
        if (msg.includes('ECONNREFUSED')) {
          console.error(`  ${dim('→ Ollama가 실행 중인지 확인: ollama serve')}`);
        } else if (msg.includes('model') && msg.includes('not found')) {
          console.error(`  ${dim('→ /models 로 사용 가능한 모델 확인')}`);
        }
      }
    } finally {
      isRunning = false;
      abortController = null;
      console.log('\n');
    }

    return true;
  }

  // Handle initial prompt
  if (initialPrompt) {
    const shouldContinue = await handleInput(initialPrompt);
    if (!shouldContinue) {
      rl.close();
      return;
    }
  }

  // Interactive loop
  while (true) {
    let input: string;
    try {
      input = await rl.question(`  ${dim(currentProvider + '/' + currentModel)} ${bold('❯')} `);
    } catch {
      // EOF or readline closed
      break;
    }

    const shouldContinue = await handleInput(input);
    if (!shouldContinue) break;
  }

  rl.close();
  console.log('  Bye!');
}

import { createInterface, type Interface as RLInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LanguageModelV1, ToolSet } from 'ai';
import { runAgentLoop } from './core/agent-loop.js';
import { getModel, clearProviderCache, getCustomProviderNames, getModelForCustomProvider } from './providers/registry.js';
import { loadConfig } from './config/loader.js';
import { PROVIDER_NAMES, LOCAL_PROVIDERS, KNOWN_MODELS } from './providers/types.js';
import { wrapToolsWithPermission } from './core/permission-gate.js';
import type { ProviderName } from './providers/types.js';
import type { Message, AgentEvent, TokenUsage } from './core/types.js';
import { SessionStore } from './session/store.js';
import { renderMarkdown } from './core/markdown.js';
import { buildSystemPrompt } from './core/system-prompt.js';
import type { RoleManager } from './roles/role-manager.js';
import type { RoleDefinition } from './roles/types.js';

const execFileAsync = promisify(execFile);

// DEBUG=1 hanimo → stderr에 디버그 로그 출력
const DEBUG = !!process.env['DEBUG'];
function debug(...args: unknown[]): void {
  if (DEBUG) console.error('[debug]', ...args);
}

// ANSI helpers
const dim = (s: string): string => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string): string => `\x1b[36m${s}\x1b[0m`;
const green = (s: string): string => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string): string => `\x1b[33m${s}\x1b[0m`;
const red = (s: string): string => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string): string => `\x1b[1m${s}\x1b[0m`;
const magenta = (s: string): string => `\x1b[35m${s}\x1b[0m`;
const inverse = (s: string): string => `\x1b[7m${s}\x1b[0m`;

// KNOWN_MODELS imported from providers/types.ts

const LANGUAGES: Record<string, string> = {
  ko: '한국어로 응답해주세요.',
  en: 'Respond in English.',
  ja: '日本語で応答してください。',
  zh: '请用中文回答。',
};

// ────────────────────────────────────────────────
// Arrow-key interactive menu (raw mode)
// ────────────────────────────────────────────────
function selectMenu(
  title: string,
  items: { label: string; value: string; active?: boolean }[],
): Promise<string | null> {
  return new Promise((resolve) => {
    if (items.length === 0) { resolve(null); return; }

    let cursor = items.findIndex(i => i.active);
    if (cursor < 0) cursor = 0;
    const maxVisible = Math.min(items.length, 12);
    let drawnLines = 0;

    function draw(clear: boolean): void {
      if (clear && drawnLines > 0) {
        process.stdout.write(`\x1b[${drawnLines}A\x1b[J`);
      }
      let lines = 0;

      console.log();
      console.log(`  ${bold(title)} ${dim('↑↓ 이동 · Enter 선택 · Esc 취소')}`);
      lines += 2;

      let start = 0;
      if (items.length > maxVisible) {
        start = Math.max(0, cursor - Math.floor(maxVisible / 2));
        if (start + maxVisible > items.length) start = items.length - maxVisible;
      }
      const end = Math.min(start + maxVisible, items.length);

      if (start > 0) { console.log(`  ${dim('  ↑ ...')}`); lines++; }

      for (let i = start; i < end; i++) {
        const item = items[i];
        if (!item) continue;
        const tag = item.active ? green(' ●') : '  ';
        if (i === cursor) {
          console.log(`  ${cyan('❯')}${tag} ${inverse(` ${item.label} `)}`);
        } else {
          console.log(`   ${tag} ${item.label}`);
        }
        lines++;
      }

      if (end < items.length) { console.log(`  ${dim('  ↓ ...')}`); lines++; }
      console.log(); lines++;
      drawnLines = lines;
    }

    draw(false);

    const wasRaw = stdin.isRaw;
    if (typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
    }
    stdin.resume();

    function cleanup(): void {
      stdin.removeListener('data', onKey);
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(wasRaw ?? false);
      }
      stdin.pause();
      if (drawnLines > 0) {
        process.stdout.write(`\x1b[${drawnLines}A\x1b[J`);
      }
    }

    function onKey(buf: Buffer): void {
      const key = buf.toString();

      // Ctrl+C or Escape → cancel
      if (key === '\x03' || key === '\x1b' || key === 'q') {
        cleanup(); resolve(null); return;
      }
      // Enter → select
      if (key === '\r' || key === '\n') {
        const picked = items[cursor];
        cleanup(); resolve(picked?.value ?? null); return;
      }
      // Up
      if (key === '\x1b[A' || key === 'k') {
        if (cursor > 0) { cursor--; draw(true); }
        return;
      }
      // Down
      if (key === '\x1b[B' || key === 'j') {
        if (cursor < items.length - 1) { cursor++; draw(true); }
        return;
      }
      // Number quick-select
      const num = parseInt(key, 10);
      if (num >= 1 && num <= Math.min(9, items.length)) {
        cursor = num - 1;
        const picked = items[cursor];
        cleanup(); resolve(picked?.value ?? null); return;
      }
    }

    stdin.on('data', onKey);
  });
}

// Main menu items
const MAIN_MENU = [
  { label: '역할 변경',       value: 'role' },
  { label: '모델 변경',       value: 'model' },
  { label: '프로바이더 변경',  value: 'provider' },
  { label: '도구 토글',       value: 'tools' },
  { label: '응답 언어',       value: 'lang' },
  { label: '설정 보기',       value: 'config' },
  { label: '대화 초기화',     value: 'clear' },
  { label: '도움말',          value: 'help' },
  { label: '종료',            value: 'exit' },
];

// ────────────────────────────────────────────────

interface TextModeOptions {
  provider: string;
  model: string;
  modelInstance: LanguageModelV1;
  systemPrompt: string;
  tools: ToolSet;
  maxSteps?: number;
  initialPrompt?: string;
  resumeSession?: {
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
  };
  roleManager?: RoleManager;
  activeRole?: RoleDefinition;
  networkMode?: string;
  streaming?: boolean;
}

// Quick connection + model verification + warmup
async function pingModel(providerName: string, modelId: string): Promise<{ ok: boolean; latency: number; loaded: boolean; error?: string }> {
  const start = Date.now();
  try {
    if (!LOCAL_PROVIDERS.has(providerName as ProviderName)) {
      return { ok: true, latency: Date.now() - start, loaded: true };
    }

    const baseURL = providerName === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8000';

    // Step 1: Check server is up
    const tagsResp = await fetch(`${baseURL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!tagsResp.ok) return { ok: false, latency: Date.now() - start, loaded: false, error: `HTTP ${tagsResp.status}` };

    // Step 2: Check model exists
    const data = await tagsResp.json() as { models?: Array<{ name: string }> };
    const models = data.models ?? [];
    const found = models.some((m: { name: string }) =>
      m.name === modelId || m.name.startsWith(modelId.split(':')[0] ?? ''),
    );
    if (!found && models.length > 0) {
      return { ok: false, latency: Date.now() - start, loaded: false, error: `모델 "${modelId}" 없음. 설치: ollama pull ${modelId}` };
    }

    // Step 3: Check if model is already loaded in memory
    try {
      const psResp = await fetch(`${baseURL}/api/ps`, { signal: AbortSignal.timeout(3000) });
      if (psResp.ok) {
        const psData = await psResp.json() as { models?: Array<{ name: string }> };
        const loadedModels = psData.models ?? [];
        const isLoaded = loadedModels.some((m: { name: string }) =>
          m.name === modelId || m.name.startsWith(modelId.split(':')[0] ?? ''),
        );
        return { ok: true, latency: Date.now() - start, loaded: isLoaded };
      }
    } catch {
      // /api/ps not available, assume not loaded
    }

    return { ok: true, latency: Date.now() - start, loaded: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, latency: Date.now() - start, loaded: false, error: msg.includes('ECONNREFUSED') ? '서버 연결 실패 — ollama serve 실행 필요' : msg };
  }
}

// Force model to load into memory with a tiny request
async function warmupModel(baseURL: string, modelId: string): Promise<number> {
  const start = Date.now();
  try {
    await fetch(`${baseURL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000), // 2 min max for model loading
    });
  } catch {
    // Timeout or error — model may still be loading
  }
  return Date.now() - start;
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
  let baseSystemPrompt = options.systemPrompt;
  const { initialPrompt } = options;
  let currentRoleObj = options.activeRole;
  const roleMgr = options.roleManager;

  // Permission gate: wrap destructive tools with readline approval prompt
  const permissionHandler = {
    async requestApproval(description: string): Promise<boolean> {
      const wasRaw = typeof stdin.setRawMode === 'function' ? stdin.isRaw : false;
      if (wasRaw && typeof stdin.setRawMode === 'function') stdin.setRawMode(false);
      const tempRl = createInterface({ input: stdin, output: stdout });
      const answer: string = await tempRl.question(`  ${yellow('⚠')} ${description} ${dim('[Y/n]')} `);
      tempRl.close();
      if (wasRaw && typeof stdin.setRawMode === 'function') stdin.setRawMode(true);
      const a = answer.trim().toLowerCase();
      return a === '' || a === 'y' || a === 'yes';
    },
  };

  let currentTools: ToolSet = wrapToolsWithPermission(
    options.tools,
    true, // requireApproval for destructive tools
    permissionHandler,
  );

  let toolsEnabled = options.tools !== undefined && Object.keys(options.tools).length > 0;
  let currentBaseURL = '';
  let langSuffix = '';
  let cachedOllamaModels: string[] = [];

  const messages: Message[] = [];

  // Session persistence — reuse existing session on resume, or create new
  const sessionStore = new SessionStore();
  let sessionId: string;

  if (options.resumeSession) {
    sessionId = options.resumeSession.sessionId;
    // Restore messages into conversation history
    for (const m of options.resumeSession.messages) {
      if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
        messages.push({ role: m.role as 'user' | 'assistant' | 'system', content: m.content });
      }
    }
  } else {
    sessionId = sessionStore.createSession(currentProvider, currentModel);
  }
  const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  if (currentProvider === 'ollama') {
    listOllamaModels().then(m => { cachedOllamaModels = m; }).catch(() => {});
  }

  function getSystemPrompt(): string {
    return langSuffix ? `${baseSystemPrompt}\n\n${langSuffix}` : baseSystemPrompt;
  }

  // Tab completer for slash commands
  function completer(line: string): [string[], string] {
    if (!line.startsWith('/')) return [[], line];
    const cmds = ['/help', '/model', '/models', '/provider', '/providers',
      '/endpoint', '/tools', '/lang', '/system', '/config', '/setup', '/clear', '/usage', '/exit', '/quit', '/menu'];
    const parts = line.split(' ');
    if (parts.length >= 2) {
      const cmd = parts[0];
      const partial = parts.slice(1).join(' ');
      if (cmd === '/provider' || cmd === '/p') {
        const hits = PROVIDER_NAMES.filter(p => p.startsWith(partial)).map(p => `${cmd} ${p}`);
        return [hits.length ? hits : PROVIDER_NAMES.map(p => `${cmd} ${p}`), line];
      }
      if (cmd === '/model' || cmd === '/m') {
        if (cachedOllamaModels.length > 0) {
          const hits = cachedOllamaModels.filter(m => m.startsWith(partial)).map(m => `${cmd} ${m}`);
          return [hits.length ? hits : cachedOllamaModels.map(m => `${cmd} ${m}`), line];
        }
      }
      if (cmd === '/tools' || cmd === '/t') {
        return [['on', 'off'].filter(o => o.startsWith(partial)).map(o => `${cmd} ${o}`), line];
      }
      if (cmd === '/lang') {
        const langs = Object.keys(LANGUAGES);
        return [langs.filter(l => l.startsWith(partial)).map(l => `/lang ${l}`), line];
      }
      return [[], line];
    }
    return [cmds.filter(c => c.startsWith(line)), line];
  }

  function printBanner(): void {
    console.log();
    const roleTag = currentRoleObj ? `${currentRoleObj.icon} ${currentRoleObj.name}` : '';
    console.log(`  ${bold('hanimo')} v0.1.0  ${dim('(')}${green(currentProvider)}${dim('/')}${cyan(currentModel)}${dim(')')}${roleTag ? `  ${magenta(roleTag)}` : ''}`);
    const toolsTag = toolsEnabled ? green('tools:ON') : dim('tools:OFF');
    console.log(`  ${dim('Esc: 메뉴 | Tab: 자동완성 | Ctrl+C: 취소/종료 |')} ${toolsTag}`);
    console.log(dim('─'.repeat(50)));
    console.log();
  }

  async function checkConnection(): Promise<void> {
    process.stdout.write(`  ${dim('연결 확인 중...')}`);
    const ping = await pingModel(currentProvider, currentModel);
    if (!ping.ok) {
      process.stdout.write(`\r  ${red('✗')} ${ping.error ?? '연결 실패'}\n\n`);
      return;
    }

    if (ping.loaded) {
      process.stdout.write(`\r  ${green('✓')} 연결됨 — 모델 준비 완료 ${dim(`(${ping.latency}ms)`)}\n\n`);
    } else {
      // Model not loaded — warmup
      process.stdout.write(`\r  ${green('✓')} 연결됨 ${dim(`(${ping.latency}ms)`)} — ${yellow('모델 로딩 중...')}`);
      const baseURL = currentProvider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8000';
      const warmupTime = await warmupModel(baseURL, currentModel);
      process.stdout.write(`\r  ${green('✓')} 연결됨 — 모델 로딩 완료 ${dim(`(${(warmupTime / 1000).toFixed(1)}s)`)}       \n\n`);
    }
  }

  printBanner();
  await checkConnection();

  const rl = createInterface({ input: stdin, output: stdout, completer });

  let isRunning = false;
  let abortController: AbortController | null = null;

  process.on('SIGINT', () => {
    if (isRunning && abortController) {
      abortController.abort();
      // Clear any waiting spinners
      process.stdout.write('\r\x1b[K'); // clear current line
      console.log(`  ${dim('(취소됨)')}`);
      isRunning = false;
      abortController = null;
    } else {
      process.stdout.write('\r\x1b[K'); // clear current line
      console.log('  Bye!');
      rl.close();
      process.exit(0);
    }
  });

  // ── Model / Provider switching ──
  async function switchModel(newModel: string): Promise<void> {
    try {
      const config = await loadConfig();
      const providerConfig = config.providers?.[currentProvider] ?? {};
      clearProviderCache();
      currentModelInstance = getModel(currentProvider as ProviderName, newModel, providerConfig);
      currentModel = newModel;
      debug('model switched to:', newModel, '| provider:', currentProvider);
      console.log(`  ${green('✓')} 모델: ${cyan(newModel)}`);
      // Verify connection with new model
      await checkConnection();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${red('✗')} 모델 변경 실패: ${msg}`);
    }
  }

  async function switchProvider(newProvider: string, newModel?: string): Promise<void> {
    const customNames = getCustomProviderNames();
    if (!PROVIDER_NAMES.includes(newProvider as ProviderName) && !customNames.includes(newProvider)) {
      console.log(`  ${red('✗')} 알 수 없는 프로바이더: ${newProvider}`);
      return;
    }
    try {
      const config = await loadConfig();
      const modelId = newModel ?? config.model;
      clearProviderCache();

      // Check custom providers first
      const customModel = getModelForCustomProvider(newProvider, modelId);
      if (customModel) {
        currentModelInstance = customModel;
      } else {
        const providerConfig = config.providers?.[newProvider] ?? {};
        currentModelInstance = getModel(newProvider as ProviderName, modelId, providerConfig);
      }
      currentProvider = newProvider;
      currentModel = modelId;
      toolsEnabled = currentTools !== undefined && Object.keys(currentTools).length > 0;
      if (newProvider === 'ollama') {
        listOllamaModels().then(m => { cachedOllamaModels = m; }).catch(() => {});
      }
      console.log(`  ${green('✓')} ${green(newProvider)}/${cyan(modelId)} ${dim('tools:')}${toolsEnabled ? green('ON') : red('OFF')}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${red('✗')} ${msg}`);
    }
  }

  // ── Interactive menus ──
  async function openModelMenu(): Promise<void> {
    const modelList = currentProvider === 'ollama'
      ? (cachedOllamaModels.length > 0 ? cachedOllamaModels : await listOllamaModels())
      : (KNOWN_MODELS[currentProvider] ?? []);
    if (currentProvider === 'ollama') {
      cachedOllamaModels = modelList;
    }

    if (modelList.length === 0) {
      console.log(`  ${dim('모델 목록 없음 — /model <name> 으로 직접 입력')}`);
      return;
    }

    const items = modelList.map(m => ({
      label: m,
      value: m,
      active: m === currentModel,
    }));

    const picked = await selectMenu(`모델 선택 (${currentProvider})`, items);
    if (picked) await switchModel(picked);
  }

  async function openProviderMenu(): Promise<void> {
    const customNames = getCustomProviderNames();
    const items = [
      ...PROVIDER_NAMES.map(p => ({
        label: `${p}${LOCAL_PROVIDERS.has(p) ? dim(' (로컬)') : ''}`,
        value: p,
        active: p === currentProvider,
      })),
      ...customNames.map(n => ({
        label: `${n} ${dim('(custom)')}`,
        value: n,
        active: n === currentProvider,
      })),
    ];
    const picked = await selectMenu('프로바이더 선택', items);
    if (picked) await switchProvider(picked);
  }

  async function openLangMenu(): Promise<void> {
    const names: Record<string, string> = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文', off: '자동 (해제)' };
    const items = [...Object.keys(LANGUAGES), 'off'].map(l => ({
      label: names[l] ?? l,
      value: l,
      active: l === 'off' ? !langSuffix : langSuffix === LANGUAGES[l],
    }));
    const picked = await selectMenu('응답 언어', items);
    if (picked === 'off') {
      langSuffix = '';
      console.log(`  ${green('✓')} 언어 제한 해제`);
    } else if (picked && LANGUAGES[picked]) {
      langSuffix = LANGUAGES[picked];
      console.log(`  ${green('✓')} 언어: ${names[picked] ?? picked}`);
    }
  }

  async function openRoleMenu(): Promise<void> {
    if (!roleMgr) {
      console.log(`  ${dim('역할 시스템 사용 불가')}`);
      return;
    }
    const roles = roleMgr.getAllRoles();
    const items = roles.map(r => ({
      label: `${r.icon} ${r.name} — ${r.description}`,
      value: r.id,
      active: r.id === currentRoleObj?.id,
    }));
    const picked = await selectMenu('역할 선택', items);
    if (picked) switchRole(picked);
  }

  function switchRole(id: string): void {
    if (!roleMgr) {
      console.log(`  ${red('✗')} 역할 시스템 사용 불가`);
      return;
    }
    const role = roleMgr.getRole(id);
    if (!role) {
      const available = roleMgr.getAllRoles().map(r => r.id).join(', ');
      console.log(`  ${red('✗')} 알 수 없는 역할: "${id}". 사용 가능: ${available}`);
      return;
    }
    currentRoleObj = role;
    const newTools = roleMgr.createToolSet(role);
    if (newTools) {
      currentTools = newTools as ToolSet;
    }
    baseSystemPrompt = buildSystemPrompt({ cwd: process.cwd(), platform: process.platform }, role);
    console.log(`  ${green('✓')} 역할: ${role.icon} ${role.name}`);
  }

  async function openMainMenu(): Promise<void> {
    const picked = await selectMenu('메뉴', MAIN_MENU);
    if (!picked) return;
    switch (picked) {
      case 'role':     await openRoleMenu(); break;
      case 'model':    await openModelMenu(); break;
      case 'provider': await openProviderMenu(); break;
      case 'tools':
        toolsEnabled = !toolsEnabled;
        console.log(`  ${green('✓')} 도구 ${toolsEnabled ? green('ON') : red('OFF')}`);
        break;
      case 'lang':     await openLangMenu(); break;
      case 'config':   await handleInput('/config'); break;
      case 'clear':
        messages.length = 0;
        console.log(`  ${green('✓')} 대화 초기화됨.`);
        break;
      case 'help':     await handleInput('/help'); break;
      case 'exit':     process.stdout.write('\r\x1b[K'); rl.close(); process.exit(0);
    }
  }

  // ── Input handler ──
  async function handleInput(input: string): Promise<boolean> {
    const trimmed = input.trim();
    if (!trimmed) return true;

    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      switch (cmd) {
        case 'help':
        case 'h':
          console.log();
          console.log(`  ${bold('명령어')} ${dim('(Tab 자동완성 | Esc 메뉴)')}`);
          console.log();
          console.log(`  ${magenta('모델 & 프로바이더')}`);
          console.log(`    ${cyan('/model')} [name]       ${dim('모델 선택/변경')}`);
          console.log(`    ${cyan('/provider')} [name]    ${dim('프로바이더 선택/변경')}`);
          console.log(`    ${cyan('/endpoint')} url [model] [key]  ${dim('커스텀 엔드포인트 연결')}`);
          console.log();
          console.log(`  ${magenta('역할')}`);
          console.log(`    ${cyan('/role')} [id]          ${dim('역할 선택/변경')}`);
          console.log(`    ${cyan('/roles')}              ${dim('역할 목록')}`);
          console.log();
          console.log(`  ${magenta('설정')}`);
          console.log(`    ${cyan('/tools')} [on|off]     ${dim('도구(파일/Git/셸) 토글')}`);
          console.log(`    ${cyan('/lang')} [ko|en|ja|zh] ${dim('응답 언어')}`);
          console.log(`    ${cyan('/system')} [text]      ${dim('시스템 프롬프트')}`);
          console.log(`    ${cyan('/config')}             ${dim('현재 설정')}`);
          console.log();
          console.log(`  ${magenta('대화')}`);
          console.log(`    ${cyan('/clear')}              ${dim('대화 초기화')}`);
          console.log(`    ${cyan('/usage')}              ${dim('토큰 사용량')}`);
          console.log(`    ${cyan('/exit')}               ${dim('종료')}`);
          console.log();
          console.log(`  ${dim('키: Esc=메뉴 Tab=완성 Ctrl+C=취소/종료')}`);
          console.log(`  ${dim('단축: /m /p /e /t /u /q')}`);
          console.log();
          return true;

        case 'model':
        case 'm':
        case 'models':
          if (args.length > 0) {
            await switchModel(args.join(' '));
          } else {
            await openModelMenu();
          }
          return true;

        case 'provider':
        case 'p':
        case 'providers':
          if (args.length > 0) {
            await switchProvider(args[0] ?? '', args[1]);
          } else {
            await openProviderMenu();
          }
          return true;

        case 'endpoint':
        case 'e': {
          // /endpoint <url> [model] [apiKey]
          if (args.length === 0) {
            console.log();
            console.log(`  ${bold('사용법')}  /endpoint <url> [model] [key]`);
            console.log();
            console.log(`  ${dim('예시:')}`);
            console.log(`    ${cyan('/endpoint')} http://localhost:11434/v1`);
            console.log(`    ${cyan('/endpoint')} http://서버:8000/v1 qwen3:30b`);
            console.log(`    ${cyan('/endpoint')} https://api.example.com/v1 mymodel sk-xxx`);
            console.log();
            if (currentBaseURL) {
              console.log(`  ${dim('현재:')} ${currentBaseURL}`);
              console.log();
            }
            return true;
          }
          const endpointUrl = args[0] ?? '';
          const endpointModel = args[1];
          const endpointKey = args[2];
          try {
            clearProviderCache();
            const providerConfig: Record<string, string> = { baseURL: endpointUrl };
            if (endpointKey) providerConfig['apiKey'] = endpointKey;
            currentModelInstance = getModel(
              'custom' as ProviderName,
              endpointModel ?? currentModel,
              providerConfig,
            );
            currentProvider = 'custom';
            currentBaseURL = endpointUrl;
            if (endpointModel) currentModel = endpointModel;
            toolsEnabled = false;
            console.log(`  ${green('✓')} ${green(endpointUrl)} ${dim('/')} ${cyan(currentModel)}${endpointKey ? dim(' (key set)') : ''} ${dim('tools:')}${red('OFF')}`);
            console.log(`  ${dim('도구 사용: /tools on')}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(`  ${red('✗')} ${msg}`);
          }
          return true;
        }

        case 'tools':
        case 't': {
          const arg = args[0]?.toLowerCase();
          if (arg === 'on') toolsEnabled = true;
          else if (arg === 'off') toolsEnabled = false;
          else toolsEnabled = !toolsEnabled;
          if (toolsEnabled) {
            console.log(`  ${green('✓')} 도구 ${green('ON')} — 파일, Git, 셸 사용 가능`);
            if (LOCAL_PROVIDERS.has(currentProvider as ProviderName)) {
              console.log(`  ${yellow('⚠')} ${dim('로컬 모델은 tool calling 미지원일 수 있음')}`);
            }
          } else {
            console.log(`  ${green('✓')} 도구 ${red('OFF')} — 순수 대화 모드`);
          }
          return true;
        }

        case 'lang':
          if (args.length > 0) {
            const lang = args[0]?.toLowerCase() ?? '';
            if (lang === 'off' || lang === 'auto') {
              langSuffix = '';
              console.log(`  ${green('✓')} 언어 제한 해제`);
            } else if (LANGUAGES[lang]) {
              langSuffix = LANGUAGES[lang];
              console.log(`  ${green('✓')} 언어: ${lang}`);
            } else {
              console.log(`  ${dim('사용:')} /lang <ko|en|ja|zh|off>`);
            }
          } else {
            await openLangMenu();
          }
          return true;

        case 'system':
          if (args.length > 0) {
            if (args[0] === 'reset') {
              baseSystemPrompt = options.systemPrompt;
              console.log(`  ${green('✓')} 시스템 프롬프트 초기화`);
            } else {
              baseSystemPrompt = `${options.systemPrompt}\n\n${args.join(' ')}`;
              console.log(`  ${green('✓')} 시스템 프롬프트 추가됨`);
            }
          } else {
            console.log(`  ${dim(getSystemPrompt().split('\n').slice(0, 5).join('\n  '))}`);
          }
          return true;

        case 'config':
          console.log();
          console.log(`  ${bold('설정')}`);
          console.log(`    프로바이더  ${green(currentProvider)}`);
          console.log(`    모델        ${cyan(currentModel)}`);
          if (currentBaseURL) console.log(`    엔드포인트  ${dim(currentBaseURL)}`);
          console.log(`    도구        ${toolsEnabled ? green('ON') : red('OFF')}`);
          console.log(`    언어        ${langSuffix ? dim(langSuffix) : dim('auto')}`);
          console.log(`    대화        ${messages.length}개`);
          console.log(`    토큰        ${totalUsage.totalTokens.toLocaleString()}`);
          console.log();
          return true;

        case 'usage':
        case 'u':
          console.log();
          console.log(`  ${bold('토큰')} prompt ${totalUsage.promptTokens.toLocaleString()} + completion ${totalUsage.completionTokens.toLocaleString()} = ${bold(totalUsage.totalTokens.toLocaleString())}`);
          console.log();
          return true;

        case 'clear':
          messages.length = 0;
          console.log(`  ${green('✓')} 대화 초기화됨.`);
          return true;

        case 'role':
          if (args.length > 0) {
            switchRole(args.join(' '));
          } else {
            await openRoleMenu();
          }
          return true;

        case 'roles':
          if (!roleMgr) {
            console.log(`  ${dim('역할 시스템 사용 불가')}`);
          } else {
            console.log();
            console.log(`  ${bold('역할 목록')}`);
            for (const r of roleMgr.getAllRoles()) {
              const marker = r.id === currentRoleObj?.id ? green(' ●') : '  ';
              console.log(`  ${marker} ${r.icon} ${cyan(r.id.padEnd(10))} ${r.name.padEnd(12)} ${dim(r.description)}`);
            }
            console.log();
            console.log(`  ${dim('/role <id> 로 역할 변경')}`);
            console.log();
          }
          return true;

        case 'menu':
          await openMainMenu();
          return true;

        case 'setup':
          console.log(`  ${dim('hanimo --setup 으로 재실행')}`);
          return true;

        case 'exit': case 'quit': case 'q':
          return false;

        default:
          console.log(`  ${dim('? /' + (cmd ?? '') + ' — /help 참고')}`);
          return true;
      }
    }

    // ── 일반 메시지 → LLM ──
    debug('send:', trimmed.slice(0, 50), '| provider:', currentProvider, '| model:', currentModel);
    messages.push({ role: 'user', content: trimmed });
    sessionStore.saveMessage(sessionId, 'user', trimmed);
    isRunning = true;
    abortController = new AbortController();

    let gotToken = false;
    let tokenBuffer = '';
    let tokenLineCount = 0;
    const startTime = Date.now();

    // Connection check before sending
    process.stdout.write(`\n  ${dim('→ ' + currentProvider + '/' + currentModel + ' 요청 중...')}`);
    process.stdout.write(`\r  ${green('→')} ${dim(currentProvider + '/' + currentModel)} `);

    // Show elapsed time while waiting for first token
    process.stdout.write(`${cyan('▌')} `);
    const waitTimer = setInterval(() => {
      if (!gotToken) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        process.stdout.write(`\r  ${cyan('▌')} ${dim(`waiting... ${elapsed}s`)}  `);
      }
    }, 1000);

    const onEvent = (event: AgentEvent): void => {
      switch (event.type) {
        case 'token':
          if (!gotToken) {
            gotToken = true;
            clearInterval(waitTimer);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            process.stdout.write(`\r  ${cyan('▌')} ${dim(`(${elapsed}s)`)} `);
            debug('first token at', elapsed, 's');
          }
          tokenBuffer += event.content;
          process.stdout.write(event.content);
          // Track newlines for cursor repositioning
          for (const ch of event.content) {
            if (ch === '\n') tokenLineCount++;
          }
          break;
        case 'tool-call':
          process.stdout.write(`\n  ${yellow('⚡')} ${dim(event.toolName + '...')}`);
          tokenBuffer = '';
          tokenLineCount = 0;
          break;
        case 'tool-result': {
          const preview = event.result.length > 200 ? event.result.slice(0, 200) + '...' : event.result;
          const lines = preview.split('\n').slice(0, 5);
          process.stdout.write(`\n  ${dim('┃')} ${dim(lines.join('\n  ┃ '))}\n  ${cyan('▌')} `);
          tokenBuffer = '';
          tokenLineCount = 0;
          break;
        }
        case 'done':
          // Re-render final response with markdown formatting
          if (tokenBuffer.trim() && tokenLineCount > 0) {
            // Move cursor up to overwrite raw streamed text
            process.stdout.write(`\x1b[${tokenLineCount + 1}A\x1b[J`);
            process.stdout.write(`  ${cyan('▌')} ${dim(`(${((Date.now() - startTime) / 1000).toFixed(1)}s)`)}\n`);
            const rendered = renderMarkdown(tokenBuffer.trim());
            process.stdout.write(rendered);
          }
          if (event.usage.promptTokens) {
            totalUsage.promptTokens += event.usage.promptTokens;
          }
          if (event.usage.completionTokens) {
            totalUsage.completionTokens += event.usage.completionTokens;
          }
          if (event.usage.totalTokens) {
            totalUsage.totalTokens += event.usage.totalTokens;
          }
          break;
        case 'error':
          process.stdout.write(`\n  ${red('✗')} ${event.error.message}`);
          break;
      }
    };

    try {
      const result = await runAgentLoop({
        model: currentModelInstance,
        systemPrompt: getSystemPrompt(),
        messages,
        tools: toolsEnabled ? currentTools : undefined,
        maxSteps: toolsEnabled ? (options.maxSteps ?? 25) : 1,
        onEvent,
        abortSignal: abortController.signal,
        streaming: options.streaming ?? true,
      });
      debug('response length:', result.response.length, '| gotToken:', gotToken);
      if (result.response) {
        // Use full messages from agent loop (includes tool calls/results)
        messages.length = 0;
        messages.push(...result.messages);
        sessionStore.saveMessage(sessionId, 'assistant', result.response);
      } else {
        // Pop the user message since we got no response
        messages.pop();
        console.log(`\n  ${yellow('⚠')} 빈 응답 — 모델이 응답하지 않았습니다`);
        if (currentProvider === 'ollama') {
          console.log(`  ${dim('확인: ollama ps | 다른 모델: /model')}`);
        }
      }
    } catch (err) {
      // Pop the user message on error so conversation stays clean
      messages.pop();
      if (err instanceof Error && err.name === 'AbortError') {
        console.log(`\n  ${dim('(취소됨)')}`);
      } else {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`\n  ${red('✗')} ${errMsg}`);
        if (errMsg.includes('ECONNREFUSED')) {
          console.error(`  ${dim('→ ollama serve 로 서버 시작')}`);
        } else if (errMsg.includes('fetch failed') || errMsg.includes('ENOTFOUND')) {
          console.error(`  ${dim('→ 네트워크 연결 확인 | /endpoint 로 URL 변경')}`);
        } else if (errMsg.includes('404') || errMsg.includes('model')) {
          console.error(`  ${dim('→ 모델 확인: ollama list | /model 로 변경')}`);
        } else {
          // Log full error for debugging
          console.error(`  ${dim('상세:')} ${dim(String(err))}`);
        }
      }
    } finally {
      clearInterval(waitTimer);
      isRunning = false;
      abortController = null;
      console.log('\n');
    }
    return true;
  }

  function getPrompt(): string {
    return `  ${dim(currentProvider + '/' + currentModel)} ${bold('❯')} `;
  }

  // ── Esc key detection on empty input ──
  let menuResolve: (() => void) | null = null;

  function setupEscHandler(rl_: RLInterface): () => void {
    const handler = (_ch: string | undefined, key: { name?: string; ctrl?: boolean; sequence?: string }) => {
      if (key?.name === 'escape' && !isRunning) {
        // Clear current line and open menu
        rl_.write(null, { ctrl: true, name: 'u' }); // clear input
        openMainMenu().then(() => {
          // Signal the main loop to re-prompt with updated model/provider
          if (menuResolve) {
            menuResolve();
            menuResolve = null;
          }
        }).catch(() => {});
      }
    };
    stdin.on('keypress', handler);
    return () => { stdin.removeListener('keypress', handler); };
  }

  // Enable keypress events
  let cleanupEscHandler: (() => void) | null = null;
  if (typeof stdin.setRawMode === 'function') {
    const { emitKeypressEvents } = await import('node:readline');
    emitKeypressEvents(stdin);
    cleanupEscHandler = setupEscHandler(rl);
  }

  // Handle initial prompt
  if (initialPrompt) {
    const shouldContinue = await handleInput(initialPrompt);
    if (!shouldContinue) { rl.close(); return; }
  }

  // Interactive loop
  while (true) {
    let input: string;
    try {
      // Use AbortController to cancel question when menu changes model
      const questionAc = new AbortController();
      menuResolve = () => questionAc.abort();

      try {
        input = await rl.question(getPrompt(), { signal: questionAc.signal });
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          // Menu triggered re-prompt — loop again with updated prompt
          menuResolve = null;
          continue;
        }
        throw e;
      }
      menuResolve = null;
    } catch {
      break;
    }
    if (!input.trim()) continue;
    const shouldContinue = await handleInput(input);
    if (!shouldContinue) break;
  }

  cleanupEscHandler?.();
  rl.close();
  console.log('  Bye!');
}

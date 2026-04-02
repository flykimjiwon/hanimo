import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const execFileAsync = promisify(execFile);

const CONFIG_DIR = join(homedir(), '.hanimo');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

// --- Endpoint Validation ---

type EndpointType = 'ollama' | 'openai-compatible' | 'unknown';

interface EndpointProbeResult {
  reachable: boolean;
  type: EndpointType;
  models?: string[];
  normalizedURL?: string;
}

/**
 * Normalize a base URL: strip trailing slashes, deduplicate paths, strip overly specific paths.
 */
function normalizeBaseURL(url: string): { url: string; warnings: string[] } {
  const warnings: string[] = [];
  let normalized = url.trim().replace(/\/+$/, '');

  // Detect doubled path segments like /v1/v1
  if (/\/v1\/v1/.test(normalized)) {
    normalized = normalized.replace(/\/v1\/v1/, '/v1');
    warnings.push('중복된 /v1 경로 제거됨');
  }

  // Strip /chat/completions (user should provide base URL only)
  if (/\/chat\/completions/.test(normalized)) {
    normalized = normalized.replace(/\/chat\/completions.*$/, '');
    warnings.push('/chat/completions 경로 제거됨 (base URL만 필요)');
  }

  // Strip /api/generate, /api/chat (Ollama-specific paths)
  if (/\/api\/(generate|chat|tags|show)/.test(normalized)) {
    normalized = normalized.replace(/\/api\/(generate|chat|tags|show).*$/, '');
    warnings.push('Ollama API 경로 제거됨 (base URL만 필요)');
  }

  // Strip /completions, /embeddings etc.
  if (/\/(completions|embeddings)$/.test(normalized)) {
    normalized = normalized.replace(/\/(completions|embeddings)$/, '');
    warnings.push('API 엔드포인트 경로 제거됨 (base URL만 필요)');
  }

  return { url: normalized, warnings };
}

/**
 * Generate URL variants to try when the given URL doesn't work.
 * Returns unique candidate URLs ordered by likelihood.
 */
function generateURLVariants(baseURL: string): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();

  const add = (url: string): void => {
    const clean = url.replace(/\/+$/, '');
    if (!seen.has(clean)) {
      seen.add(clean);
      variants.push(clean);
    }
  };

  // Original
  add(baseURL);

  try {
    const urlObj = new URL(baseURL);
    const origin = urlObj.origin;
    const path = urlObj.pathname.replace(/\/+$/, '');

    // Try with /v1 appended
    if (!path.endsWith('/v1')) {
      add(`${origin}${path}/v1`);
    }

    // Try without /v1 suffix
    if (path.endsWith('/v1')) {
      add(`${origin}${path.slice(0, -3)}`);
    }

    // Try origin only (no path)
    if (path && path !== '/') {
      add(origin);
      add(`${origin}/v1`);
    }

    // Try http ↔ https swap
    if (urlObj.protocol === 'https:') {
      const httpURL = baseURL.replace('https://', 'http://');
      add(httpURL);
      if (!path.endsWith('/v1')) add(`${httpURL}/v1`);
    } else {
      const httpsURL = baseURL.replace('http://', 'https://');
      add(httpsURL);
      if (!path.endsWith('/v1')) add(`${httpsURL}/v1`);
    }

    // For common local ports, try alternate ports
    const localPorts: Record<string, string[]> = {
      '11434': ['8000', '1234', '8080'],  // Ollama → vLLM, LM Studio, generic
      '8000': ['11434', '1234', '8080'],   // vLLM → Ollama, LM Studio, generic
      '1234': ['11434', '8000', '8080'],   // LM Studio → Ollama, vLLM, generic
    };
    const altPorts = localPorts[urlObj.port];
    if (altPorts && (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1')) {
      for (const port of altPorts) {
        const alt = `${urlObj.protocol}//${urlObj.hostname}:${port}`;
        add(alt);
        add(`${alt}/v1`);
      }
    }
  } catch {
    // Invalid URL — just return original
  }

  return variants;
}

/**
 * Quick probe: try a single fetch with short timeout.
 * Returns the endpoint type if reachable, null otherwise.
 */
async function quickProbe(
  url: string,
  timeoutMs = 3000,
): Promise<EndpointProbeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const opts: RequestInit = { signal: controller.signal };

  try {
    const origin = new URL(url).origin;

    // Try Ollama native: GET /api/tags
    try {
      const resp = await fetch(`${origin}/api/tags`, opts);
      if (resp.ok) {
        const data = await resp.json() as { models?: Array<{ name: string }> };
        return {
          reachable: true,
          type: 'ollama',
          models: data.models?.map(m => m.name) ?? [],
          normalizedURL: `${origin}/v1`,
        };
      }
    } catch { /* continue */ }

    // Try OpenAI-compatible: GET /models (from various base paths)
    const modelsURLs = [
      url.endsWith('/v1') ? `${url}/models` : null,
      `${url}/v1/models`,
      `${url}/models`,
    ].filter(Boolean) as string[];

    for (const modelsURL of modelsURLs) {
      try {
        const resp = await fetch(modelsURL, opts);
        if (resp.ok) {
          const data = await resp.json() as { data?: Array<{ id: string }> };
          // Derive the correct base URL from the successful models URL
          const normalizedURL = modelsURL.replace(/\/models$/, '');
          return {
            reachable: true,
            type: 'openai-compatible',
            models: data.data?.map(m => m.id) ?? [],
            normalizedURL: normalizedURL.endsWith('/v1') ? normalizedURL : `${normalizedURL}/v1`,
          };
        }
      } catch { /* continue */ }
    }

    // Server reachable but API unknown
    try {
      const resp = await fetch(origin, { ...opts, method: 'HEAD' });
      if (resp.ok || resp.status < 500) {
        return { reachable: true, type: 'unknown' };
      }
    } catch { /* continue */ }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try multiple URL variants in sequence, printing progress.
 * Returns the first successful probe result with its URL.
 */
async function probeWithVariants(
  baseURL: string,
  timeoutPerAttempt = 3000,
): Promise<{ result: EndpointProbeResult; url: string } | null> {
  // First, try the given URL directly
  const direct = await quickProbe(baseURL, timeoutPerAttempt);
  if (direct?.reachable) {
    return { result: direct, url: baseURL };
  }

  // Generate and try variants
  const variants = generateURLVariants(baseURL);
  // Skip first (already tried as direct)
  const remaining = variants.slice(1);

  if (remaining.length === 0) return null;

  console.log(`  ⚠ "${baseURL}" 응답 없음 — ${remaining.length}개 URL 변형 시도 중...`);

  for (const variant of remaining) {
    process.stdout.write(`    → ${variant} ... `);
    const result = await quickProbe(variant, timeoutPerAttempt);
    if (result?.reachable) {
      console.log(`✓ (${result.type})`);
      return { result, url: variant };
    }
    console.log('✗');
  }

  return null;
}

/**
 * Send a minimal test chat completion request to verify the server works.
 */
async function testChatCompletion(
  baseURL: string,
  model: string,
  apiKey?: string,
  timeoutMs = 10000,
): Promise<{ success: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const chatURL = baseURL.endsWith('/v1') ? `${baseURL}/chat/completions` : `${baseURL}/v1/chat/completions`;
    const resp = await fetch(chatURL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (resp.ok) return { success: true };
    const text = await resp.text().catch(() => '');
    return { success: false, error: `HTTP ${resp.status}: ${text.slice(0, 200)}` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validate and potentially fix provider/URL mismatch.
 * Tries multiple URL variants if the original doesn't respond.
 * Returns corrected provider and baseURL.
 */
async function validateEndpoint(
  provider: string,
  baseURL: string,
  rl: ReturnType<typeof createInterface>,
): Promise<{ provider: string; baseURL: string; detectedModels?: string[] }> {
  const { url: normalized, warnings } = normalizeBaseURL(baseURL);

  for (const w of warnings) {
    console.log(`  ⚠ ${w}`);
  }

  console.log();
  console.log('  엔드포인트 검증 중...');

  const probeResult = await probeWithVariants(normalized);

  if (!probeResult) {
    console.log();
    console.log('  ✗ 모든 URL 변형에서 서버 응답을 받지 못했습니다.');
    console.log(`    입력한 URL: ${baseURL}`);
    console.log('    확인할 사항:');
    console.log('      1. 서버가 실행 중인지');
    console.log('      2. 방화벽/네트워크 설정');
    console.log('      3. URL의 프로토콜(http/https)과 포트 번호');
    console.log();
    const proceed = await rl.question('  그래도 원래 URL로 진행할까요? [y/N]: ');
    if (proceed.trim().toLowerCase() !== 'y') {
      console.log('  설정을 취소합니다. 다시 시도하세요.');
      process.exit(0);
    }
    return { provider, baseURL: normalized };
  }

  const { result: probe, url: workingURL } = probeResult;
  const finalURL = probe.normalizedURL ?? workingURL;

  // Show what we found
  if (workingURL !== normalized) {
    console.log();
    console.log(`  ✓ 자동 보정: "${normalized}" → "${finalURL}"`);
  } else {
    console.log(`  ✓ 서버 응답 확인 (${probe.type})`);
  }

  if (probe.models && probe.models.length > 0) {
    const preview = probe.models.slice(0, 5).join(', ');
    const more = probe.models.length > 5 ? ` 외 ${probe.models.length - 5}개` : '';
    console.log(`  ✓ 사용 가능한 모델: ${preview}${more}`);
  }

  // Handle unknown server type: warn and test with a real chat completion
  if (probe.type === 'unknown') {
    console.log();
    console.log('  ⚠ 서버 타입을 감지할 수 없습니다 (Ollama /api/tags, OpenAI /models 모두 응답 없음).');
    console.log('  채팅 완성 요청으로 서버 동작을 확인합니다...');
    const testModel = 'default';
    const testResult = await testChatCompletion(finalURL, testModel);
    if (!testResult.success) {
      console.log(`  ✗ 테스트 요청 실패: ${testResult.error ?? '알 수 없는 오류'}`);
      console.log();
      const proceed = await rl.question('  서버가 제대로 동작하지 않을 수 있습니다. 그래도 진행할까요? [y/N]: ');
      if (proceed.trim().toLowerCase() !== 'y') {
        console.log('  설정을 취소합니다. 다시 시도하세요.');
        process.exit(0);
      }
    } else {
      console.log('  ✓ 채팅 완성 요청 성공 — OpenAI 호환 서버로 간주합니다.');
    }
  }

  // Check for provider/endpoint mismatch
  let correctedProvider = provider;

  if (provider === 'ollama' && probe.type === 'openai-compatible') {
    console.log();
    console.log('  ⚠ Ollama로 선택했지만, 이 서버는 OpenAI 호환 API로 감지됩니다.');
    console.log('    Ollama는 /api/chat, OpenAI 호환은 /v1/chat/completions 를 사용합니다.');
    const fix = await rl.question('  자동으로 "custom" 프로바이더로 전환할까요? [Y/n]: ');
    if (fix.trim().toLowerCase() !== 'n') {
      correctedProvider = 'custom';
      console.log('  → 프로바이더를 "custom"으로 전환합니다.');
    }
  } else if (provider === 'custom' && probe.type === 'ollama') {
    console.log();
    console.log('  ⚠ Custom으로 선택했지만, 이 서버는 Ollama로 감지됩니다.');
    const fix = await rl.question('  자동으로 "ollama" 프로바이더로 전환할까요? [Y/n]: ');
    if (fix.trim().toLowerCase() !== 'n') {
      correctedProvider = 'ollama';
      console.log('  → 프로바이더를 "ollama"로 전환합니다.');
    }
  } else if ((provider === 'vllm' || provider === 'lmstudio') && probe.type === 'ollama') {
    console.log();
    console.log(`  ⚠ ${provider}로 선택했지만, 이 서버는 Ollama로 감지됩니다.`);
    const fix = await rl.question('  자동으로 "ollama" 프로바이더로 전환할까요? [Y/n]: ');
    if (fix.trim().toLowerCase() !== 'n') {
      correctedProvider = 'ollama';
      console.log('  → 프로바이더를 "ollama"로 전환합니다.');
    }
  }

  return { provider: correctedProvider, baseURL: finalURL, detectedModels: probe.models };
}

/**
 * Interactive model selector with pagination and search.
 * Shows PAGE_SIZE models at a time. User can:
 * - Enter a number to select
 * - Enter 'n' for next page, 'p' for previous page
 * - Type text to search/filter models
 * - Enter nothing to use default
 */
async function selectModel(
  models: string[],
  defaultModel: string,
  rl: ReturnType<typeof createInterface>,
): Promise<string> {
  const PAGE_SIZE = 15;
  let page = 0;
  let filtered = models;
  let searchTerm = '';

  const totalPages = () => Math.ceil(filtered.length / PAGE_SIZE);

  function printPage(): void {
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, filtered.length);
    console.log();
    if (searchTerm) {
      console.log(`  검색: "${searchTerm}" (${filtered.length}개 결과)`);
    }
    console.log(`  모델 목록 (${start + 1}-${end} / ${filtered.length}개):`);
    for (let i = start; i < end; i++) {
      console.log(`    ${i + 1}) ${filtered[i]}`);
    }
    console.log();
    const nav: string[] = [];
    if (page > 0) nav.push('p=이전');
    if (page < totalPages() - 1) nav.push('n=다음');
    nav.push('텍스트=검색');
    console.log(`  ${nav.join(' | ')}`);
  }

  while (true) {
    printPage();
    const input = await rl.question(`  모델 선택 [번호/검색어] (기본: ${defaultModel}): `);
    const trimmed = input.trim();

    // Empty → use default
    if (!trimmed) return defaultModel;

    // Pagination
    if (trimmed === 'n' && page < totalPages() - 1) { page++; continue; }
    if (trimmed === 'p' && page > 0) { page--; continue; }

    // Number selection
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= 1 && num <= filtered.length) {
      return filtered[num - 1]!;
    }

    // Search/filter
    searchTerm = trimmed.toLowerCase();
    filtered = models.filter(m => m.toLowerCase().includes(searchTerm));
    page = 0;

    if (filtered.length === 0) {
      console.log(`  ⚠ "${trimmed}" 검색 결과 없음`);
      // Check if user meant to type a model name directly
      const confirm = await rl.question(`  "${trimmed}"을(를) 모델명으로 직접 사용할까요? [y/N]: `);
      if (confirm.trim().toLowerCase() === 'y') return trimmed;
      // Reset search
      filtered = models;
      searchTerm = '';
    } else if (filtered.length === 1) {
      // Auto-select if only one result
      console.log(`  → ${filtered[0]}`);
      return filtered[0]!;
    }
  }
}

interface SavedConfig {
  provider: string;
  model: string;
  streaming?: boolean;
  providers: Record<string, { apiKey?: string; baseURL?: string }>;
}

interface OllamaModel {
  name: string;
  size: string;
}

async function listOllamaModels(): Promise<OllamaModel[]> {
  try {
    const { stdout: output } = await execFileAsync('ollama', ['list'], { timeout: 10000 });
    const lines = output.trim().split('\n');
    // First line is header: "NAME  ID  SIZE  MODIFIED"
    if (lines.length <= 1) return [];

    const models: OllamaModel[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.trim().split(/\s{2,}/);
      const name = parts[0];
      const size = parts[2];
      if (name && size) {
        models.push({ name, size });
      }
    }
    return models;
  } catch {
    return [];
  }
}

async function hasValidConfig(): Promise<boolean> {
  // Check env vars first
  if (
    process.env['OPENAI_API_KEY'] ||
    process.env['ANTHROPIC_API_KEY'] ||
    process.env['GOOGLE_API_KEY']
  ) {
    return true;
  }

  // Check config file
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content) as Record<string, unknown>;
    // If config has a provider set, it's valid (Ollama doesn't need API keys)
    if (config['provider']) return true;
  } catch {
    // No config file
  }

  return false;
}

export async function needsOnboarding(): Promise<boolean> {
  return !(await hasValidConfig());
}

export async function runOnboarding(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  // Ctrl+C / Ctrl+Break during onboarding → clean exit
  const exitHandler = (): void => {
    console.log('\n  Bye!');
    rl.close();
    process.exit(0);
  };
  process.on('SIGINT', exitHandler);
  if (process.platform === 'win32') {
    process.on('SIGBREAK', exitHandler);
  }

  console.log();
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     hanimo  v0.1.0              ║');
  console.log('  ║     터미널 AI 코딩 어시스턴트          ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log();
  console.log('  처음 오셨군요! LLM 프로바이더를 설정합니다.');
  console.log();
  console.log('  사용 가능한 프로바이더:');
  console.log();
  console.log('  ── 클라우드 API ──');
  console.log('    1) OpenAI       (gpt-4o, gpt-4.1, codex-mini)');
  console.log('    2) Anthropic    (claude-sonnet-4, claude-haiku-4)');
  console.log('    3) Google       (gemini-2.5-flash, gemini-2.5-pro)');
  console.log('    4) DeepSeek     (deepseek-chat, deepseek-coder) — 가성비');
  console.log('    5) Groq         (qwen-qwq-32b, llama-3.3-70b) — 초고속');
  console.log('    6) Together     (Qwen2.5-Coder-32B, DeepSeek-V3)');
  console.log('    7) OpenRouter   (수백 개 모델 통합)');
  console.log('    8) Fireworks    (Qwen2.5-Coder-32B, DeepSeek-V3)');
  console.log('    9) Mistral      (codestral, mistral-large)');
  console.log('   10) GLM/Zhipu   (glm-4-plus, codegeex-4)');
  console.log();
  console.log('  ── 로컬 / 사내망 ──');
  console.log('   11) Ollama       (qwen3-coder:30b 등 — API 키 불필요)');
  console.log('   12) vLLM         (자체 모델 서버)');
  console.log('   13) LM Studio    (데스크톱 LLM)');
  console.log('   14) Custom       (OpenAI 호환 엔드포인트)');
  console.log();
  console.log('  ── Custom Provider (config.json에서 추가) ──');
  console.log('   *) config.example.jsonc 참고 — customProviders 배열에 직접 추가');
  console.log();

  const choice = await rl.question('  프로바이더 선택 [1-14] (기본: 1): ');
  const providerChoice = choice.trim() || '1';

  let provider: string;
  let model: string;
  let apiKey = '';
  let baseURL: string | undefined;

  // Cloud providers with API key
  const cloudMap: Record<string, { name: string; model: string; keyHint: string }> = {
    '4':  { name: 'deepseek',   model: 'deepseek-chat',                                       keyHint: 'DeepSeek API Key (sk-...)' },
    '5':  { name: 'groq',       model: 'qwen-qwq-32b',                                        keyHint: 'Groq API Key (gsk_...)' },
    '6':  { name: 'together',   model: 'Qwen/Qwen2.5-Coder-32B-Instruct',                     keyHint: 'Together API Key' },
    '7':  { name: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324:free',                  keyHint: 'OpenRouter API Key (sk-or-...)' },
    '8':  { name: 'fireworks',  model: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct', keyHint: 'Fireworks API Key' },
    '9':  { name: 'mistral',    model: 'codestral-latest',                                     keyHint: 'Mistral API Key' },
    '10': { name: 'glm',        model: 'glm-4-plus',                                           keyHint: 'GLM/Zhipu API Key' },
  };

  const cloudMatch = cloudMap[providerChoice];

  if (cloudMatch) {
    provider = cloudMatch.name;
    model = cloudMatch.model;
    console.log();
    apiKey = await rl.question(`  ${cloudMatch.keyHint}: `);
  } else if (providerChoice === '2') {
    provider = 'anthropic';
    model = 'claude-sonnet-4-20250514';
    console.log();
    apiKey = await rl.question('  Anthropic API Key (sk-ant-...): ');
  } else if (providerChoice === '3') {
    provider = 'google';
    model = 'gemini-2.5-flash';
    console.log();
    apiKey = await rl.question('  Google AI API Key: ');
  } else if (providerChoice === '11' || providerChoice === '12' || providerChoice === '13' || providerChoice === '14') {
    // Local / self-hosted providers
    const localMap: Record<string, { name: string; model: string; defaultURL: string }> = {
      '11': { name: 'ollama',   model: 'qwen3-coder:30b',  defaultURL: 'http://localhost:11434/v1' },
      '12': { name: 'vllm',     model: 'default',           defaultURL: 'http://localhost:8000' },
      '13': { name: 'lmstudio', model: 'default',           defaultURL: 'http://localhost:1234' },
      '14': { name: 'custom',   model: 'default',           defaultURL: '' },
    };
    const local = localMap[providerChoice]!;
    provider = local.name;
    model = local.model;
    console.log();
    const urlInput = await rl.question(`  서버 URL (기본: ${local.defaultURL || '없음 — 필수 입력'}): `);
    baseURL = urlInput.trim() || (local.defaultURL || undefined);

    // Ask for API key (optional for local, common for remote custom servers)
    if (providerChoice === '14' || providerChoice === '12') {
      console.log();
      const keyInput = await rl.question('  API 키 (없으면 Enter): ');
      if (keyInput.trim()) {
        apiKey = keyInput.trim();
      }
    }

    // Validate endpoint and auto-correct provider/URL mismatch
    let detectedModels: string[] | undefined;
    if (baseURL) {
      const validated = await validateEndpoint(provider, baseURL, rl);
      provider = validated.provider;
      baseURL = validated.baseURL;
      detectedModels = validated.detectedModels;
    }

    if (provider === 'ollama') {
      // Try to fetch installed models via `ollama list`
      console.log();
      console.log('  Ollama 모델 목록 조회 중...');
      const ollamaModels = await listOllamaModels();

      if (ollamaModels.length > 0) {
        const ollamaNames = ollamaModels.map(m => `${m.name}  (${m.size})`);
        const selected = await selectModel(ollamaNames, model, rl);
        // Strip size info if present
        model = selected.replace(/\s+\(.*\)$/, '');
      } else if (detectedModels && detectedModels.length > 0) {
        console.log('  (ollama list 실행 불가 — 서버에서 감지된 모델 사용)');
        model = await selectModel(detectedModels, model, rl);
      } else {
        console.log('  ⚠ ollama list 실행 실패 — Ollama가 설치/실행 중인지 확인하세요.');
        console.log();
        const ollamaModel = await rl.question(`  모델명 직접 입력 (기본: ${model}): `);
        if (ollamaModel.trim()) model = ollamaModel.trim();
      }
    } else if (detectedModels && detectedModels.length > 0) {
      // Non-ollama local provider: offer models from endpoint probe
      console.log();
      console.log('  서버에서 감지된 모델:');
      model = await selectModel(detectedModels, detectedModels[0] ?? model, rl);
    } else {
      console.log();
      const modelInput = await rl.question(`  모델명 직접 입력 (기본: ${model}): `);
      if (modelInput.trim()) model = modelInput.trim();
    }
  } else {
    // Default: OpenAI
    provider = 'openai';
    model = 'gpt-4o-mini';
    console.log();
    apiKey = await rl.question('  OpenAI API Key (sk-...): ');
  }

  apiKey = apiKey.trim();

  // Require API key for cloud providers (not local/custom)
  const localProviderSet = new Set(['ollama', 'vllm', 'lmstudio', 'custom']);
  if (!localProviderSet.has(provider) && !apiKey) {
    console.log();
    console.log('  ⚠ 클라우드 프로바이더는 API 키가 필요합니다.');
    console.log(`  ${provider} API 키를 발급받은 후 다시 시도하세요.`);
    console.log();
    rl.close();
    process.exit(0);
  }

  // Ask for model override
  if (provider !== 'ollama') {
    console.log();
    const modelOverride = await rl.question(`  모델 (기본: ${model}): `);
    if (modelOverride.trim()) model = modelOverride.trim();
  }

  process.removeListener('SIGINT', exitHandler);
  if (process.platform === 'win32') {
    process.removeListener('SIGBREAK', exitHandler);
  }
  rl.close();

  // Save config
  // Local/custom providers often don't support SSE streaming reliably
  const localProviders = new Set(['ollama', 'vllm', 'lmstudio', 'custom']);
  const savedConfig: SavedConfig = {
    provider,
    model,
    ...(localProviders.has(provider) ? { streaming: false } : {}),
    providers: {},
  };

  const providerEntry: { apiKey?: string; baseURL?: string } = {};
  if (apiKey) providerEntry.apiKey = apiKey;
  if (baseURL) providerEntry.baseURL = baseURL;
  if (Object.keys(providerEntry).length > 0) {
    savedConfig.providers[provider] = providerEntry;
  }

  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, JSON.stringify(savedConfig, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });

  console.log();
  console.log(`  ✓ 설정 저장됨: ${CONFIG_PATH}`);
  console.log(`  ✓ 프로바이더: ${provider}, 모델: ${model}`);
  console.log();
}

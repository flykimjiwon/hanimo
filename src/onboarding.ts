import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const execFileAsync = promisify(execFile);

const CONFIG_DIR = join(homedir(), '.dev-anywhere');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

interface SavedConfig {
  provider: string;
  model: string;
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

  // Ctrl+C during onboarding → clean exit
  process.on('SIGINT', () => {
    console.log('\n  Bye!');
    rl.close();
    process.exit(0);
  });

  console.log();
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║     devany  v0.1.0             ║');
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
      '11': { name: 'ollama',   model: 'qwen3-coder:30b',  defaultURL: 'http://localhost:11434' },
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

    if (provider === 'ollama') {
      // Try to fetch installed models via `ollama list`
      console.log();
      console.log('  Ollama 모델 목록 조회 중...');
      const ollamaModels = await listOllamaModels();

      if (ollamaModels.length > 0) {
        console.log();
        console.log('  설치된 모델:');
        for (const [i, m] of ollamaModels.entries()) {
          console.log(`    ${i + 1}) ${m.name}  (${m.size})`);
        }
        console.log();
        const modelChoice = await rl.question(`  모델 선택 [1-${ollamaModels.length}] 또는 직접 입력: `);
        const idx = parseInt(modelChoice.trim(), 10);
        const picked = ollamaModels[idx - 1];
        if (picked) {
          model = picked.name;
        } else if (modelChoice.trim()) {
          model = modelChoice.trim();
        }
      } else {
        console.log('  ⚠ ollama list 실행 실패 — Ollama가 설치/실행 중인지 확인하세요.');
        console.log();
        const ollamaModel = await rl.question(`  모델명 직접 입력 (기본: ${model}): `);
        if (ollamaModel.trim()) model = ollamaModel.trim();
      }
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

  // Ask for model override
  if (provider !== 'ollama') {
    console.log();
    const modelOverride = await rl.question(`  모델 (기본: ${model}): `);
    if (modelOverride.trim()) model = modelOverride.trim();
  }

  rl.close();

  // Save config
  const savedConfig: SavedConfig = {
    provider,
    model,
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

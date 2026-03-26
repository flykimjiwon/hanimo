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
  console.log('    1) OpenAI      (gpt-4o, gpt-4o-mini)');
  console.log('    2) Anthropic   (claude-sonnet, claude-haiku)');
  console.log('    3) Google      (gemini-2.0-flash)');
  console.log('    4) Ollama      (로컬 모델 — API 키 불필요)');
  console.log();

  const choice = await rl.question('  프로바이더 선택 [1-4] (기본: 1): ');
  const providerChoice = choice.trim() || '1';

  let provider: string;
  let model: string;
  let apiKey = '';
  let baseURL: string | undefined;

  switch (providerChoice) {
    case '2':
      provider = 'anthropic';
      model = 'claude-sonnet-4-20250514';
      console.log();
      apiKey = await rl.question('  Anthropic API Key (sk-ant-...): ');
      break;
    case '3':
      provider = 'google';
      model = 'gemini-2.0-flash';
      console.log();
      apiKey = await rl.question('  Google AI API Key: ');
      break;
    case '4': {
      provider = 'ollama';
      model = 'llama3.2';
      console.log();
      const ollamaURL = await rl.question('  Ollama URL (기본: http://localhost:11434): ');
      baseURL = ollamaURL.trim() || undefined;

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
      break;
    }
    default:
      provider = 'openai';
      model = 'gpt-4o-mini';
      console.log();
      apiKey = await rl.question('  OpenAI API Key (sk-...): ');
      break;
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

  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(savedConfig, null, 2) + '\n', 'utf-8');

  console.log();
  console.log(`  ✓ 설정 저장됨: ${CONFIG_PATH}`);
  console.log(`  ✓ 프로바이더: ${provider}, 모델: ${model}`);
  console.log();
}

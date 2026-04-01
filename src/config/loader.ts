import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { ConfigSchema, type Config } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result;
}

async function readJsonFile(path: string): Promise<Record<string, unknown> | null> {
  try {
    const content = await readFile(path, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function getEnvOverrides(): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  const providerOverrides: Record<string, Record<string, string>> = {};

  // Explicit hanimo env vars (MODOL_ kept for backwards compat)
  const provider = process.env['HANIMO_PROVIDER'] ?? process.env['MODOL_PROVIDER'];
  if (provider) {
    overrides['provider'] = provider;
  }

  const model = process.env['HANIMO_MODEL'] ?? process.env['MODOL_MODEL'];
  if (model) {
    overrides['model'] = model;
  }

  const baseURL = process.env['HANIMO_BASE_URL'] ?? process.env['MODOL_BASE_URL'];
  const apiKey = process.env['HANIMO_API_KEY'] ?? process.env['MODOL_API_KEY'];

  if (baseURL || apiKey) {
    const p = (provider ?? DEFAULT_CONFIG.provider) as string;
    providerOverrides[p] = {
      ...(baseURL ? { baseURL } : {}),
      ...(apiKey ? { apiKey } : {}),
    };
  }

  // Auto-detect well-known API key env vars
  const autoDetect: Array<{ env: string; provider: string; model: string }> = [
    { env: 'OPENAI_API_KEY',        provider: 'openai',    model: 'gpt-4o-mini' },
    { env: 'ANTHROPIC_API_KEY',     provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
    { env: 'GOOGLE_API_KEY',        provider: 'google',    model: 'gemini-2.5-flash' },
    { env: 'DEEPSEEK_API_KEY',      provider: 'deepseek',  model: 'deepseek-chat' },
    { env: 'GROQ_API_KEY',          provider: 'groq',      model: 'qwen-qwq-32b' },
    { env: 'TOGETHER_API_KEY',      provider: 'together',  model: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
    { env: 'OPENROUTER_API_KEY',    provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324:free' },
    { env: 'FIREWORKS_API_KEY',     provider: 'fireworks', model: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct' },
    { env: 'MISTRAL_API_KEY',       provider: 'mistral',   model: 'codestral-latest' },
  ];

  for (const { env, provider: p } of autoDetect) {
    const val = process.env[env];
    if (val) {
      providerOverrides[p] = { ...providerOverrides[p], apiKey: val };
    }
  }

  // If no explicit provider set, auto-select first available key
  if (!provider) {
    for (const { env, provider: p, model: m } of autoDetect) {
      if (process.env[env]) {
        overrides['provider'] = p;
        if (!model) overrides['model'] = m;
        break;
      }
    }
  }

  if (Object.keys(providerOverrides).length > 0) {
    overrides['providers'] = providerOverrides;
  }

  return overrides;
}

export async function loadConfig(cwd?: string): Promise<Config> {
  let merged: Record<string, unknown> = { ...DEFAULT_CONFIG } as unknown as Record<
    string,
    unknown
  >;

  // Layer 2: User config (~/.hanimo/config.json)
  const userConfigPath = join(homedir(), '.hanimo', 'config.json');
  const userConfig = await readJsonFile(userConfigPath);
  if (userConfig) {
    merged = deepMerge(merged, userConfig);
  }

  // Layer 3: Project config (<cwd>/.hanimo.json)
  const projectDir = cwd ?? process.cwd();
  const projectConfigPath = join(projectDir, '.hanimo.json');
  const projectConfig = await readJsonFile(projectConfigPath);
  if (projectConfig) {
    merged = deepMerge(merged, projectConfig);
  }

  // Layer 4: Environment variable overrides
  const envOverrides = getEnvOverrides();
  if (Object.keys(envOverrides).length > 0) {
    merged = deepMerge(merged, envOverrides);
  }

  // Validate with Zod
  return ConfigSchema.parse(merged);
}

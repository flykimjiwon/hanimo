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

  const provider = process.env['DEV_ANYWHERE_PROVIDER'];
  if (provider) {
    overrides['provider'] = provider;
  }

  const model = process.env['DEV_ANYWHERE_MODEL'];
  if (model) {
    overrides['model'] = model;
  }

  const baseURL = process.env['DEV_ANYWHERE_BASE_URL'];
  if (baseURL) {
    const provider_ = (overrides['provider'] ?? DEFAULT_CONFIG.provider) as string;
    overrides['providers'] = {
      [provider_]: { baseURL },
    };
  }

  return overrides;
}

export async function loadConfig(cwd?: string): Promise<Config> {
  let merged: Record<string, unknown> = { ...DEFAULT_CONFIG } as unknown as Record<
    string,
    unknown
  >;

  // Layer 2: User config (~/.dev-anywhere/config.json)
  const userConfigPath = join(homedir(), '.dev-anywhere', 'config.json');
  const userConfig = await readJsonFile(userConfigPath);
  if (userConfig) {
    merged = deepMerge(merged, userConfig);
  }

  // Layer 3: Project config (<cwd>/.dev-anywhere.json)
  const projectDir = cwd ?? process.cwd();
  const projectConfigPath = join(projectDir, '.dev-anywhere.json');
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

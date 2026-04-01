/**
 * Model Registry — 자동 모델 정보 업데이트
 *
 * OpenRouter API (무료, 키 불필요)에서 500+ 모델 메타데이터를 가져와 로컬 캐시.
 * 새 모델이 나오면 자동으로 인식 — 하드코딩 불필요.
 *
 * 데이터: 모델 ID, 이름, 컨텍스트 길이, 가격, 모달리티
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  pricing: {
    promptPerMToken: number;  // USD per 1M tokens
    completionPerMToken: number;
  };
  modality: string;
  maxCompletionTokens?: number;
  description?: string;
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture: { modality: string };
  top_provider: { context_length: number; max_completion_tokens?: number };
  description?: string;
}

const CACHE_DIR = join(homedir(), '.hanimo', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'model-registry.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

interface CachedRegistry {
  timestamp: number;
  models: ModelInfo[];
}

/**
 * Fetch all models from OpenRouter (free, no API key needed)
 */
async function fetchFromOpenRouter(): Promise<ModelInfo[]> {
  try {
    const resp = await fetch(OPENROUTER_API, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) return [];

    const data = await resp.json() as { data: OpenRouterModel[] };

    return (data.data ?? []).map((m): ModelInfo => ({
      id: m.id,
      name: m.name,
      contextLength: m.context_length,
      pricing: {
        promptPerMToken: parseFloat(m.pricing.prompt) * 1_000_000,
        completionPerMToken: parseFloat(m.pricing.completion) * 1_000_000,
      },
      modality: m.architecture?.modality ?? 'text->text',
      maxCompletionTokens: m.top_provider?.max_completion_tokens,
      description: m.description,
    }));
  } catch {
    return [];
  }
}

/**
 * Load cached registry from disk
 */
function loadCache(): CachedRegistry | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as CachedRegistry;
    if (Date.now() - data.timestamp > CACHE_TTL_MS) return null; // Expired
    return data;
  } catch {
    return null;
  }
}

/**
 * Save registry to disk cache
 */
function saveCache(models: ModelInfo[]): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    const data: CachedRegistry = { timestamp: Date.now(), models };
    writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch {
    // Cache write failure is non-critical
  }
}

/**
 * Get all model info — cached or fresh from OpenRouter
 */
export async function getModelRegistry(): Promise<ModelInfo[]> {
  // Try cache first
  const cached = loadCache();
  if (cached) return cached.models;

  // Fetch fresh
  const models = await fetchFromOpenRouter();
  if (models.length > 0) {
    saveCache(models);
  }
  return models;
}

/**
 * Force refresh the registry (ignores cache)
 */
export async function refreshModelRegistry(): Promise<ModelInfo[]> {
  const models = await fetchFromOpenRouter();
  if (models.length > 0) {
    saveCache(models);
  }
  return models;
}

/**
 * Look up a specific model's info
 */
export async function getModelInfo(modelId: string): Promise<ModelInfo | undefined> {
  const registry = await getModelRegistry();
  // Exact match
  const exact = registry.find(m => m.id === modelId);
  if (exact) return exact;
  // Partial match (e.g., "gpt-4o" matches "openai/gpt-4o")
  return registry.find(m => m.id.endsWith('/' + modelId) || m.name.toLowerCase().includes(modelId.toLowerCase()));
}

/**
 * Get pricing for a model (returns per 1M tokens)
 */
export async function getModelPricing(modelId: string): Promise<{ input: number; output: number } | null> {
  const info = await getModelInfo(modelId);
  if (!info) return null;
  return {
    input: info.pricing.promptPerMToken,
    output: info.pricing.completionPerMToken,
  };
}

/**
 * Get registry summary
 */
export async function getRegistrySummary(): Promise<string> {
  const cached = loadCache();
  if (!cached) return 'No model registry cached. Run /models refresh to update.';

  const age = Math.round((Date.now() - cached.timestamp) / 1000 / 60);
  const providers = new Set(cached.models.map(m => m.id.split('/')[0]));

  return `${cached.models.length} models from ${providers.size} providers (cached ${age}m ago)`;
}

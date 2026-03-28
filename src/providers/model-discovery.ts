/**
 * Dynamic model discovery — query providers for actually available models.
 * Replaces hardcoded KNOWN_MODELS for providers that support model listing.
 */

import type { ProviderName } from './types.js';

export interface DiscoveredModel {
  id: string;
  name: string;
  size?: string;
}

const PROVIDER_LIST_URLS: Partial<Record<ProviderName, string>> = {
  ollama: 'http://localhost:11434',
  vllm: 'http://localhost:8000',
  lmstudio: 'http://localhost:1234',
};

const CLOUD_LIST_URLS: Partial<Record<ProviderName, string>> = {
  openai: 'https://api.openai.com',
  deepseek: 'https://api.deepseek.com',
  groq: 'https://api.groq.com/openai',
  together: 'https://api.together.xyz',
  fireworks: 'https://api.fireworks.ai',
  mistral: 'https://api.mistral.ai',
  openrouter: 'https://openrouter.ai/api',
};

/**
 * Fetch available models from Ollama /api/tags
 */
async function fetchOllamaModels(baseURL: string): Promise<DiscoveredModel[]> {
  try {
    const resp = await fetch(`${baseURL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return [];
    const data = await resp.json() as { models?: Array<{ name: string; size?: number }> };
    return (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      size: m.size ? formatSize(m.size) : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch available models from OpenAI-compatible /v1/models
 */
async function fetchOpenAIModels(baseURL: string, apiKey?: string): Promise<DiscoveredModel[]> {
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(`${baseURL}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json() as { data?: Array<{ id: string }> };
    return (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.id,
    }));
  } catch {
    return [];
  }
}

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)}GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
}

/**
 * Discover available models for a provider.
 * Returns empty array if discovery fails (fallback to KNOWN_MODELS).
 */
export async function discoverModels(
  provider: ProviderName,
  providerConfig?: { apiKey?: string; baseURL?: string },
): Promise<DiscoveredModel[]> {
  const customBaseURL = providerConfig?.baseURL;
  const apiKey = providerConfig?.apiKey;

  // Ollama — use /api/tags
  if (provider === 'ollama') {
    const base = customBaseURL ?? PROVIDER_LIST_URLS['ollama']!;
    return fetchOllamaModels(base);
  }

  // vLLM / LM Studio — use /v1/models
  if (provider === 'vllm' || provider === 'lmstudio') {
    const base = customBaseURL ?? PROVIDER_LIST_URLS[provider]!;
    return fetchOpenAIModels(base);
  }

  // Custom provider — use /v1/models
  if (provider === 'custom' && customBaseURL) {
    return fetchOpenAIModels(customBaseURL, apiKey);
  }

  // Cloud providers — need API key
  const cloudBase = customBaseURL ?? CLOUD_LIST_URLS[provider];
  if (cloudBase && apiKey) {
    return fetchOpenAIModels(cloudBase, apiKey);
  }

  // No discovery possible
  return [];
}

// Cache to avoid repeated API calls
const modelCache = new Map<string, { models: DiscoveredModel[]; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function discoverModelsWithCache(
  provider: ProviderName,
  providerConfig?: { apiKey?: string; baseURL?: string },
): Promise<DiscoveredModel[]> {
  const key = `${provider}:${providerConfig?.baseURL ?? 'default'}`;
  const cached = modelCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.models;
  }

  const models = await discoverModels(provider, providerConfig);
  if (models.length > 0) {
    modelCache.set(key, { models, timestamp: Date.now() });
  }
  return models;
}

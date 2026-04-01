export const PROVIDER_NAMES = [
  // Cloud APIs (native SDK)
  'openai',
  'anthropic',
  'google',
  // Cloud APIs (OpenAI-compatible)
  'deepseek',
  'groq',
  'together',
  'openrouter',
  'fireworks',
  'mistral',
  'glm',
  // Local / self-hosted
  'ollama',
  'vllm',
  'lmstudio',
  'custom',
] as const;

export type ProviderName = typeof PROVIDER_NAMES[number];

export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
}

// Providers that run locally (no API key needed, tools may not work)
// Note: 'custom' is intentionally excluded — it can be remote (DGX SPARK, etc.)
export const LOCAL_PROVIDERS = new Set<ProviderName>([
  'ollama',
  'vllm',
  'lmstudio',
]);

// Default base URLs for OpenAI-compatible providers
export const PROVIDER_BASE_URLS: Partial<Record<ProviderName, string>> = {
  deepseek: 'https://api.deepseek.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  together: 'https://api.together.xyz/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
  mistral: 'https://api.mistral.ai/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  ollama: 'http://localhost:11434/v1',
  vllm: 'http://localhost:8000/v1',
  lmstudio: 'http://localhost:1234/v1',
};

// Recommended coding models per provider (20-40B sweet spot highlighted)
export const KNOWN_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3-mini', 'codex-mini-latest'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-opus-4-20250514'],
  google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  groq: ['qwen-qwq-32b', 'llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b-specdec', 'llama-3.1-8b-instant'],
  together: ['Qwen/Qwen2.5-Coder-32B-Instruct', 'deepseek-ai/DeepSeek-V3', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
  openrouter: ['deepseek/deepseek-chat-v3-0324:free', 'qwen/qwen3-coder', 'google/gemini-2.5-flash-preview', 'anthropic/claude-sonnet-4'],
  fireworks: ['accounts/fireworks/models/qwen2p5-coder-32b-instruct', 'accounts/fireworks/models/deepseek-v3', 'accounts/fireworks/models/llama-v3p3-70b-instruct'],
  mistral: ['codestral-latest', 'mistral-large-latest', 'mistral-small-latest'],
  glm: ['glm-4-plus', 'glm-4-flash', 'codegeex-4'],
  // Local models — expanded with tool calling capable models
  ollama: [
    // 20B+ Agent tier
    'qwen3-coder:30b', 'qwen3.5:27b', 'qwen3:32b', 'devstral:24b',
    'nemotron-cascade-2:30b', 'gpt-oss:20b',
    // 10B-20B
    'qwen3:14b', 'deepseek-coder-v2:16b',
    // 5B-10B Agent tier
    'qwen3.5:9b', 'qwen3:8b', 'llama3.1:8b',
    // 5B-10B Assistant tier
    'qwen2.5-coder:7b', 'mistral:7b',
    // Under 5B
    'qwen3.5:4b', 'qwen3:4b', 'nemotron-3-nano:4b', 'phi4-mini:3.8b', 'granite4:3b',
    // Chat-only
    'llama3.2:3b', 'gemma3:1b', 'codegemma:7b', 'starcoder2:15b', 'codellama:34b',
  ],
  vllm: [],
  lmstudio: [],
};

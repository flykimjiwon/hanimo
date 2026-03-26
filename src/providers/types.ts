export const PROVIDER_NAMES = ['openai', 'anthropic', 'google', 'ollama', 'glm', 'vllm', 'custom'] as const;
export type ProviderName = typeof PROVIDER_NAMES[number];

export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
}

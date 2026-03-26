import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { ProviderName, ProviderConfig } from './types.js';

interface ProviderInstance {
  getModel(modelId: string): LanguageModelV1;
}

function createProviderInstance(
  name: ProviderName,
  config: ProviderConfig,
): ProviderInstance {
  switch (name) {
    case 'openai': {
      const provider = createOpenAI({
        apiKey: config.apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      });
      return {
        getModel(modelId: string) {
          return provider(modelId);
        },
      };
    }

    case 'anthropic': {
      const provider = createAnthropic({
        apiKey: config.apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      });
      return {
        getModel(modelId: string) {
          return provider(modelId);
        },
      };
    }

    case 'google': {
      const provider = createGoogleGenerativeAI({
        apiKey: config.apiKey,
        ...(config.baseURL ? { baseURL: config.baseURL } : {}),
      });
      return {
        getModel(modelId: string) {
          return provider(modelId);
        },
      };
    }

    // OpenAI-compatible providers share the same factory
    case 'ollama':
    case 'glm':
    case 'vllm':
    case 'custom': {
      const baseURLMap: Record<string, string> = {
        ollama: 'http://localhost:11434/v1',
        glm: 'https://open.bigmodel.cn/api/paas/v4',
        vllm: 'http://localhost:8000/v1',
        custom: '',
      };
      const baseURL = config.baseURL ?? baseURLMap[name];
      if (!baseURL) {
        throw new Error(`Provider "${name}" requires a baseURL in config`);
      }
      const provider = createOpenAI({
        apiKey: config.apiKey ?? 'not-needed',
        baseURL,
        compatibility: 'compatible',
      });
      return {
        getModel(modelId: string) {
          return provider(modelId);
        },
      };
    }
  }
}

const providerCache = new Map<string, ProviderInstance>();

function getCacheKey(name: ProviderName, config: ProviderConfig): string {
  return `${name}:${config.baseURL ?? ''}:${config.apiKey ?? ''}`;
}

export function createProvider(
  name: ProviderName,
  config: ProviderConfig = {},
): ProviderInstance {
  const key = getCacheKey(name, config);
  let instance = providerCache.get(key);
  if (!instance) {
    instance = createProviderInstance(name, config);
    providerCache.set(key, instance);
  }
  return instance;
}

export function getModel(
  providerName: ProviderName,
  modelId: string,
  config: ProviderConfig = {},
): LanguageModelV1 {
  const key = getCacheKey(providerName, config);
  let instance = providerCache.get(key);
  if (!instance) {
    instance = createProviderInstance(providerName, config);
    providerCache.set(key, instance);
  }
  return instance.getModel(modelId);
}

export function clearProviderCache(): void {
  providerCache.clear();
}

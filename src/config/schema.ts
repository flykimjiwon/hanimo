import { z } from 'zod';

export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().url().optional(),
  defaultModel: z.string().optional(),
});

export const ConfigSchema = z.object({
  provider: z
    .enum(['openai', 'anthropic', 'google', 'ollama', 'glm', 'vllm', 'custom'])
    .default('openai'),
  model: z.string().default('gpt-4o-mini'),
  providers: z.record(z.string(), ProviderConfigSchema).optional(),
  maxWorkers: z.number().min(1).max(16).default(4),
  maxSteps: z.number().min(1).max(100).default(25),
  shell: z
    .object({
      timeout: z.number().default(30000),
      requireApproval: z.boolean().default(true),
    })
    .default({}),
  tui: z
    .object({
      theme: z.enum(['dark', 'light']).default('dark'),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfigEntry = z.infer<typeof ProviderConfigSchema>;

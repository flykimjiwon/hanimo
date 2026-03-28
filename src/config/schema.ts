import { z } from 'zod';

export const ProviderConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseURL: z.string().url().optional(),
  defaultModel: z.string().optional(),
});

export const EndpointSchema = z.object({
  name: z.string().describe('Display name (e.g. "local-ollama", "dgx-spark")'),
  provider: z
    .enum(['openai', 'anthropic', 'google', 'deepseek', 'groq', 'together', 'openrouter', 'fireworks', 'mistral', 'glm', 'ollama', 'vllm', 'lmstudio', 'custom'])
    .describe('Provider type'),
  baseURL: z.string().describe('Endpoint URL (e.g. http://localhost:11434)'),
  apiKey: z.string().optional().describe('API key (optional for local providers)'),
  enabled: z.boolean().default(true),
  priority: z.number().default(0).describe('Higher = preferred when same model exists on multiple endpoints'),
});

export const McpServerConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  onlineOnly: z.boolean().optional(),
  // stdio transport
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  // SSE/HTTP transport
  url: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const ConfigSchema = z.object({
  provider: z
    .enum(['openai', 'anthropic', 'google', 'deepseek', 'groq', 'together', 'openrouter', 'fireworks', 'mistral', 'glm', 'ollama', 'vllm', 'lmstudio', 'custom'])
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
  defaultRole: z.string().default('dev'),
  subAgents: z
    .object({
      enabled: z.boolean().default(false),
      count: z.enum(['3', '5', '10']).default('3'),
      model: z.string().optional(),
    })
    .default({}),
  mcp: z
    .object({
      servers: z.record(z.string(), McpServerConfigSchema).default({}),
    })
    .default({}),
  network: z
    .object({
      mode: z.enum(['auto', 'online', 'offline']).default('auto'),
    })
    .default({}),
  endpoints: z.array(EndpointSchema).default([]),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfigEntry = z.infer<typeof ProviderConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;

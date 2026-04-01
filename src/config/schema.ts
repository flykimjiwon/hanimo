import { z } from 'zod';
import { FeatureFlagSchema } from '../core/feature-flags.js';

export const HookDefSchema = z.object({
  command: z.string(),
  timeout: z.number().default(5000),
});

export const HookConfigSchema = z.object({
  PreToolUse: z.array(HookDefSchema).default([]),
  PostToolUse: z.array(HookDefSchema).default([]),
  SessionStart: z.array(HookDefSchema).default([]),
  SessionStop: z.array(HookDefSchema).default([]),
  UserPromptSubmit: z.array(HookDefSchema).default([]),
}).default({});

export const PermissionRuleSchema = z.object({
  tool: z.string(),
  argMatch: z.string().optional(),
  action: z.enum(['allow', 'deny', 'ask']),
});

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

export const CustomProviderSchema = z.object({
  name: z.string().describe('Display name (e.g. "my-server")'),
  baseURL: z.string().describe('API endpoint URL'),
  apiKey: z.string().optional().describe('API key (optional for local servers)'),
  models: z.array(z.string()).default([]).describe('Available model names'),
  protocol: z.enum(['openai', 'anthropic']).default('openai').describe('API protocol'),
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
  customProviders: z.array(CustomProviderSchema).default([]),
  featureFlags: FeatureFlagSchema.default({}),
  hooks: HookConfigSchema,
  permissionRules: z.array(PermissionRuleSchema).default([]),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfigEntry = z.infer<typeof ProviderConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;
export type CustomProvider = z.infer<typeof CustomProviderSchema>;
export type HookDef = z.infer<typeof HookDefSchema>;
export type HookConfig = z.infer<typeof HookConfigSchema>;
export type PermissionRule = z.infer<typeof PermissionRuleSchema>;

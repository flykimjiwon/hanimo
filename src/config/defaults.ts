import type { Config } from './schema.js';

export const DEFAULT_CONFIG: Config = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  providers: undefined,
  maxWorkers: 4,
  maxSteps: 25,
  streaming: true,
  shell: {
    timeout: 30000,
    requireApproval: true,
  },
  tui: {
    theme: 'dark',
  },
  defaultRole: 'hanimo',
  subAgents: {
    enabled: false,
    count: '3',
    model: undefined,
  },
  mcp: {
    servers: {},
  },
  network: {
    mode: 'auto',
  },
  endpoints: [],
  customProviders: [],
  featureFlags: {
    HOOK_SYSTEM: false,
    MEMORY_SYSTEM: false,
    HEADLESS_MODE: false,
    SESSION_FORK: false,
    PROMPT_CACHE: false,
    PERMISSION_GLOB_RULES: false,
    MULTI_STAGE_COMPACTION: false,
  },
  hooks: {
    PreToolUse: [],
    PostToolUse: [],
    SessionStart: [],
    SessionStop: [],
    UserPromptSubmit: [],
  },
  permissionRules: [],
};

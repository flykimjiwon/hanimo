import type { Config } from './schema.js';

export const DEFAULT_CONFIG: Config = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  providers: undefined,
  maxWorkers: 4,
  maxSteps: 25,
  shell: {
    timeout: 30000,
    requireApproval: true,
  },
  tui: {
    theme: 'dark',
  },
  defaultRole: 'dev',
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
};

// Model capability registry — determines role (Agent/Assistant/Chat) per model
// Matching priority: exact name → prefix → provider default → safe fallback

export type ModelRole = 'agent' | 'assistant' | 'chat';

export interface ModelCapability {
  role: ModelRole;
  toolCalling: boolean;
  codingTier: 'strong' | 'moderate' | 'weak' | 'none';
  note?: string;
}

// Role display helpers
export const ROLE_LABELS: Record<ModelRole, string> = {
  agent: 'Agent',
  assistant: 'Assist',
  chat: 'Chat',
};

export const ROLE_BADGES: Record<ModelRole, string> = {
  agent: '[A]',
  assistant: '[R]',
  chat: '[C]',
};

// ── Exact-match registry ──────────────────────────────────────────────

const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // ── 5B 이하 ──────────────────────────────────────
  'qwen3.5:4b':          { role: 'assistant', toolCalling: true,  codingTier: 'moderate', note: '4B 최강, tool calling 정확도 높음' },
  'qwen3:4b':            { role: 'assistant', toolCalling: true,  codingTier: 'moderate', note: 'thinking 모드 주의' },
  'nemotron-3-nano:4b':  { role: 'assistant', toolCalling: true,  codingTier: 'moderate', note: 'NVIDIA 효율적' },
  'phi4-mini:3.8b':      { role: 'assistant', toolCalling: true,  codingTier: 'moderate', note: 'finish_reason 이슈 가능' },
  'granite4:3b':         { role: 'assistant', toolCalling: true,  codingTier: 'moderate', note: 'IBM 엔터프라이즈' },
  'llama3.2:3b':         { role: 'chat',      toolCalling: false, codingTier: 'weak',     note: '프롬프트 기반 tool만' },
  'qwen3:1.7b':          { role: 'chat',      toolCalling: true,  codingTier: 'weak',     note: '도구 신뢰성 낮음' },
  'gemma3:1b':           { role: 'chat',      toolCalling: false, codingTier: 'none' },
  'qwen3:0.6b':          { role: 'chat',      toolCalling: true,  codingTier: 'none',     note: '토이급' },

  // ── 5B ~ 10B ─────────────────────────────────────
  'qwen3.5:9b':          { role: 'agent',     toolCalling: true,  codingTier: 'strong',   note: 'GPT-OSS-120B급 성능' },
  'qwen3:8b':            { role: 'agent',     toolCalling: true,  codingTier: 'strong',   note: 'thinking 모드로 복잡한 작업도 가능' },
  'llama3.1:8b':         { role: 'agent',     toolCalling: true,  codingTier: 'strong',   note: 'tool calling 안정성 최고' },
  'qwen2.5-coder:7b':    { role: 'assistant', toolCalling: true,  codingTier: 'strong',   note: 'tool calling finish_reason 버그' },
  'mistral:7b':          { role: 'assistant', toolCalling: true,  codingTier: 'moderate' },
  'codegemma:7b':        { role: 'chat',      toolCalling: false, codingTier: 'moderate' },

  // ── 10B ~ 20B ────────────────────────────────────
  'qwen3:14b':           { role: 'agent',     toolCalling: true,  codingTier: 'strong',   note: '품질/자원 밸런스 최적' },
  'deepseek-coder-v2:16b': { role: 'assistant', toolCalling: true, codingTier: 'strong',  note: '커뮤니티 Modelfile 필요' },
  'starcoder2:15b':      { role: 'chat',      toolCalling: false, codingTier: 'moderate', note: '코드 완성 전용' },
  'codellama:34b':       { role: 'chat',      toolCalling: false, codingTier: 'moderate', note: '구형, Ollama 네이티브 tool 미지원' },

  // ── 20B ~ 50B ────────────────────────────────────
  'qwen3-coder:30b':     { role: 'agent',     toolCalling: true,  codingTier: 'strong',   note: '코딩 에이전트 최강, 256K 컨텍스트' },
  'qwen3.5:27b':         { role: 'agent',     toolCalling: true,  codingTier: 'strong',   note: 'SWE-bench GPT-5 mini급' },
  'qwen3:32b':           { role: 'agent',     toolCalling: true,  codingTier: 'strong' },
  'devstral:24b':        { role: 'agent',     toolCalling: true,  codingTier: 'strong',   note: 'Mistral 코딩 에이전트 특화' },
  'nemotron-cascade-2:30b': { role: 'agent',  toolCalling: true,  codingTier: 'strong',   note: 'NVIDIA, 24GB VRAM OK' },
  'gpt-oss:20b':         { role: 'agent',     toolCalling: true,  codingTier: 'moderate', note: 'OpenAI 오픈소스, Apache 2.0' },
  'qwen2.5-coder:32b':   { role: 'assistant', toolCalling: true,  codingTier: 'strong',   note: 'tool calling 포맷 이슈' },
  'command-r:35b':       { role: 'assistant', toolCalling: true,  codingTier: 'weak',     note: 'RAG 특화' },

  // ── llama3.2 (default tag) ───────────────────────
  'llama3.2':            { role: 'chat',      toolCalling: false, codingTier: 'weak' },
};

// ── Prefix-based fallbacks ────────────────────────────────────────────
// Ordered from most specific to least; first match wins

const PREFIX_CAPABILITIES: Array<{ prefix: string; capability: ModelCapability }> = [
  // qwen3-coder → always agent (MoE, strong coding)
  { prefix: 'qwen3-coder',     capability: { role: 'agent',     toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'qwen3.5',         capability: { role: 'agent',     toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'qwen3',           capability: { role: 'agent',     toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'qwen2.5-coder',   capability: { role: 'assistant', toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'devstral',        capability: { role: 'agent',     toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'llama3.1',        capability: { role: 'agent',     toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'llama3.3',        capability: { role: 'agent',     toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'llama3.2',        capability: { role: 'chat',      toolCalling: false, codingTier: 'weak' } },
  { prefix: 'nemotron',        capability: { role: 'agent',     toolCalling: true,  codingTier: 'moderate' } },
  { prefix: 'phi4',            capability: { role: 'assistant', toolCalling: true,  codingTier: 'moderate' } },
  { prefix: 'granite',         capability: { role: 'assistant', toolCalling: true,  codingTier: 'moderate' } },
  { prefix: 'mistral',         capability: { role: 'assistant', toolCalling: true,  codingTier: 'moderate' } },
  { prefix: 'gemma',           capability: { role: 'chat',      toolCalling: false, codingTier: 'weak' } },
  { prefix: 'starcoder',       capability: { role: 'chat',      toolCalling: false, codingTier: 'moderate' } },
  { prefix: 'codellama',       capability: { role: 'chat',      toolCalling: false, codingTier: 'moderate' } },
  { prefix: 'codegemma',       capability: { role: 'chat',      toolCalling: false, codingTier: 'moderate' } },
  { prefix: 'deepseek-coder',  capability: { role: 'assistant', toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'deepseek',        capability: { role: 'agent',     toolCalling: true,  codingTier: 'strong' } },
  { prefix: 'command-r',       capability: { role: 'assistant', toolCalling: true,  codingTier: 'weak' } },
  { prefix: 'gpt-oss',         capability: { role: 'agent',     toolCalling: true,  codingTier: 'moderate' } },
];

// Cloud API providers always support tool calling → agent
const CLOUD_AGENT_PROVIDERS = new Set([
  'openai', 'anthropic', 'google', 'deepseek', 'groq',
  'together', 'openrouter', 'fireworks', 'mistral', 'glm',
]);

const DEFAULT_CAPABILITY: ModelCapability = {
  role: 'chat',
  toolCalling: false,
  codingTier: 'none',
};

/**
 * Determine model capability by matching:
 * 1. Exact model name
 * 2. Prefix match (longest prefix first — array is ordered)
 * 3. Cloud API provider → agent
 * 4. Fallback → chat (safe default)
 */
export function getModelCapability(modelName: string, provider?: string): ModelCapability {
  // 1. Exact match
  const exact = MODEL_CAPABILITIES[modelName];
  if (exact) return exact;

  // 2. Prefix match
  for (const entry of PREFIX_CAPABILITIES) {
    if (modelName.startsWith(entry.prefix)) {
      return entry.capability;
    }
  }

  // 3. Cloud provider → all models are agent-capable
  if (provider && CLOUD_AGENT_PROVIDERS.has(provider)) {
    return { role: 'agent', toolCalling: true, codingTier: 'strong' };
  }

  // 4. Safe fallback
  return DEFAULT_CAPABILITY;
}

/**
 * Get all registered model names (for listing)
 */
export function getRegisteredModels(): string[] {
  return Object.keys(MODEL_CAPABILITIES);
}

/**
 * Mode Presets — 사용 가능한 모델을 분석해서 역할별 최적 모델을 자동 배정
 *
 * Modes:
 * - turbo:    최고 성능 모델 배정 (가장 큰 모델)
 * - balanced: 중간 크기, 성능/속도 균형
 * - eco:      가장 작은 모델, 최대 효율 (빠르고 가벼움)
 * - auto:     사용 가능한 모델 분석 후 자동 최적화
 */

export interface ModelAssignment {
  /** Primary model for the role */
  model: string;
  /** Which endpoint to use */
  endpoint?: string;
  /** Why this model was chosen */
  reason: string;
}

export interface ModePreset {
  id: string;
  name: string;
  nameKo: string;
  description: string;
  descriptionKo: string;
  icon: string;
  roles: {
    super: ModelAssignment;
    dev: ModelAssignment;
    plan: ModelAssignment;
    chat: ModelAssignment;
  };
}

interface AvailableModel {
  id: string;
  endpoint: string;
  provider: string;
  /** Estimated parameter size in billions (extracted from name) */
  sizeB: number;
  /** Capability tier: coding, general, reasoning, embedding */
  capability: 'coding' | 'general' | 'reasoning' | 'embedding' | 'vision';
}

/**
 * Extract parameter size from model name (e.g., "qwen3:8b" → 8, "gpt-oss:120b" → 120)
 */
function extractSizeB(modelId: string): number {
  // Match patterns like :8b, :14b, :120b, :32b-instruct, 8x22b
  const match = modelId.match(/(\d+)x(\d+)b/i);
  if (match) return parseInt(match[1]!) * parseInt(match[2]!); // 8x22b = 176

  const sizeMatch = modelId.match(/(\d+\.?\d*)b/i);
  if (sizeMatch) return parseFloat(sizeMatch[1]!);

  // Known sizes for models without explicit size
  const knownSizes: Record<string, number> = {
    // Cloud models (estimated effective size for ranking)
    'claude-opus-4-20250514': 2000,
    'claude-sonnet-4-20250514': 1000,
    'claude-haiku-4-20250414': 200,
    'gpt-4o': 1500,
    'gpt-4.1': 1500,
    'gpt-4o-mini': 300,
    'gpt-4.1-mini': 300,
    'gpt-4.1-nano': 100,
    'o3-mini': 800,
    'o4-mini': 900,
    'codex-mini-latest': 500,
    'gemini-2.5-pro': 1800,
    'gemini-2.5-flash': 400,
    'gemini-2.0-flash': 300,
    'deepseek-chat': 671,
    'deepseek-coder': 671,
    'deepseek-reasoner': 671,
    'mistral-large-latest': 123,
    'codestral-latest': 123,
    'mistral-small-latest': 24,
    'glm-4-plus': 500,
    'glm-4-flash': 100,
    'glm-4-air': 150,
    'llama-3.3-70b-versatile': 70,
    'qwen-qwq-32b': 32,
    'llama-3.1-8b-instant': 8,
    // Self-hosted large models
    'deepseek-v3:latest': 671,
    'mixtral:8x22b-instruct': 176,
    'llama3.3:latest': 70,
    'mistral-small3.2:latest': 24,
  };

  for (const [pattern, size] of Object.entries(knownSizes)) {
    if (modelId.includes(pattern.split(':')[0]!)) return size;
  }

  return 7; // Default assumption
}

/**
 * Classify model capability from name
 */
function classifyCapability(modelId: string): AvailableModel['capability'] {
  const lower = modelId.toLowerCase();
  if (lower.includes('embed') || lower.includes('arctic-embed') || lower.includes('nomic-embed') || lower.includes('mxbai-embed')) return 'embedding';
  if (lower.includes('llava') || lower.includes('ocr') || lower.includes('vision')) return 'vision';
  if (lower.includes('coder') || lower.includes('codex') || lower.includes('codestral') || lower.includes('starcoder') || lower.includes('codellama') || lower.includes('devstral')) return 'coding';
  if (lower.includes('deepseek-r1') || lower.includes('reasoner') || lower.includes('qwq') || lower.includes('o3-') || lower.includes('o4-')) return 'reasoning';
  return 'general';
}

/**
 * Analyze all available models and classify them
 */
function analyzeModels(
  models: Array<{ id: string; endpoint: string; provider: string }>,
): AvailableModel[] {
  return models
    .map((m) => ({
      ...m,
      sizeB: extractSizeB(m.id),
      capability: classifyCapability(m.id),
    }))
    .filter((m) => m.capability !== 'embedding') // Exclude embedding-only models
    .sort((a, b) => b.sizeB - a.sizeB); // Largest first
}

/**
 * Pick best model for a role from available models
 */
function pickForRole(
  models: AvailableModel[],
  prefer: 'coding' | 'general' | 'reasoning',
  sizePreference: 'largest' | 'medium' | 'smallest',
): AvailableModel | undefined {
  // Filter by preferred capability, fallback to all
  let candidates = models.filter((m) => m.capability === prefer);
  if (candidates.length === 0) candidates = models.filter((m) => m.capability !== 'vision');
  if (candidates.length === 0) candidates = models;

  if (sizePreference === 'largest') return candidates[0];
  if (sizePreference === 'smallest') return candidates[candidates.length - 1];
  // medium: pick from middle third
  const mid = Math.floor(candidates.length / 2);
  return candidates[mid];
}

function toAssignment(model: AvailableModel | undefined, reason: string): ModelAssignment {
  if (!model) return { model: 'qwen3:8b', reason: 'fallback (no models found)' };
  return {
    model: model.id,
    endpoint: model.endpoint,
    reason: `${model.sizeB}B ${model.capability} @${model.endpoint} — ${reason}`,
  };
}

/**
 * Generate all mode presets from available models
 */
export function generatePresets(
  models: Array<{ id: string; endpoint: string; provider: string }>,
): ModePreset[] {
  const analyzed = analyzeModels(models);

  if (analyzed.length === 0) {
    return [getDefaultPreset()];
  }

  // Turbo: biggest models for everything
  const turbo: ModePreset = {
    id: 'turbo',
    name: 'Turbo',
    nameKo: '터보',
    description: 'Maximum performance — largest models for all roles',
    descriptionKo: '최고 성능 — 모든 역할에 가장 큰 모델',
    icon: '🚀',
    roles: {
      super: toAssignment(pickForRole(analyzed, 'general', 'largest'), 'largest general'),
      dev: toAssignment(pickForRole(analyzed, 'coding', 'largest'), 'largest coding'),
      plan: toAssignment(pickForRole(analyzed, 'reasoning', 'largest'), 'largest reasoning'),
      chat: toAssignment(pickForRole(analyzed, 'general', 'medium'), 'medium for fast chat'),
    },
  };

  // Balanced: medium models
  const balanced: ModePreset = {
    id: 'balanced',
    name: 'Balanced',
    nameKo: '균형',
    description: 'Good performance with reasonable speed',
    descriptionKo: '성능과 속도의 균형',
    icon: '⚖️',
    roles: {
      super: toAssignment(pickForRole(analyzed, 'general', 'medium'), 'medium general'),
      dev: toAssignment(pickForRole(analyzed, 'coding', 'medium'), 'medium coding'),
      plan: toAssignment(pickForRole(analyzed, 'reasoning', 'medium'), 'medium reasoning'),
      chat: toAssignment(pickForRole(analyzed, 'general', 'smallest'), 'small for fast chat'),
    },
  };

  // Eco: smallest models, maximum speed
  const eco: ModePreset = {
    id: 'eco',
    name: 'Eco',
    nameKo: '효율',
    description: 'Fastest response — smallest capable models',
    descriptionKo: '최고 속도 — 가장 작고 빠른 모델',
    icon: '🌱',
    roles: {
      super: toAssignment(pickForRole(analyzed, 'general', 'smallest'), 'smallest general'),
      dev: toAssignment(pickForRole(analyzed, 'coding', 'smallest'), 'smallest coding'),
      plan: toAssignment(pickForRole(analyzed, 'general', 'smallest'), 'smallest for plan'),
      chat: toAssignment(pickForRole(analyzed, 'general', 'smallest'), 'smallest for chat'),
    },
  };

  // Auto: coding model for dev, reasoning for plan, biggest for super, small for chat
  const auto: ModePreset = {
    id: 'auto',
    name: 'Auto',
    nameKo: '자동',
    description: 'Automatically optimized — best model for each role',
    descriptionKo: '자동 최적화 — 역할별 최적 모델 자동 배정',
    icon: '🐶',
    roles: {
      super: toAssignment(pickForRole(analyzed, 'general', 'largest'), 'best overall'),
      dev: toAssignment(pickForRole(analyzed, 'coding', 'largest'), 'best coding'),
      plan: toAssignment(pickForRole(analyzed, 'reasoning', 'largest'), 'best reasoning'),
      chat: toAssignment(pickForRole(analyzed, 'general', 'smallest'), 'fastest for chat'),
    },
  };

  return [auto, turbo, balanced, eco];
}

function getDefaultPreset(): ModePreset {
  const fallback: ModelAssignment = { model: 'qwen3:8b', reason: 'default fallback' };
  return {
    id: 'auto',
    name: 'Auto',
    nameKo: '자동',
    description: 'Default preset (no models discovered)',
    descriptionKo: '기본 프리셋 (모델 미발견)',
    icon: '🐶',
    roles: { super: fallback, dev: fallback, plan: fallback, chat: fallback },
  };
}

/**
 * Format preset for display
 */
export function formatPreset(preset: ModePreset, ko: boolean): string {
  const lines = [
    `${preset.icon} ${ko ? preset.nameKo : preset.name} — ${ko ? preset.descriptionKo : preset.description}`,
    '',
    `  Super:  ${preset.roles.super.model} (${preset.roles.super.reason})`,
    `  Dev:    ${preset.roles.dev.model} (${preset.roles.dev.reason})`,
    `  Plan:   ${preset.roles.plan.model} (${preset.roles.plan.reason})`,
    `  Chat:   ${preset.roles.chat.model} (${preset.roles.chat.reason})`,
  ];
  return lines.join('\n');
}

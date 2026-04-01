import { z } from 'zod';

export const FeatureFlagSchema = z.object({
  HOOK_SYSTEM: z.boolean().default(false),
  MEMORY_SYSTEM: z.boolean().default(false),
  HEADLESS_MODE: z.boolean().default(false),
  SESSION_FORK: z.boolean().default(false),
  PROMPT_CACHE: z.boolean().default(false),
  PERMISSION_GLOB_RULES: z.boolean().default(false),
  MULTI_STAGE_COMPACTION: z.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof FeatureFlagSchema>;
export type FeatureFlagName = keyof FeatureFlags;

let flags: FeatureFlags = FeatureFlagSchema.parse({});

/**
 * Initialize feature flags from config, then apply env overrides.
 * Env pattern: HANIMO_FF_<FLAG_NAME>=1|true
 */
export function initFeatureFlags(configFlags?: Partial<FeatureFlags>): void {
  const base = FeatureFlagSchema.parse(configFlags ?? {});

  // Apply env overrides
  const result = { ...base };
  for (const key of Object.keys(result) as FeatureFlagName[]) {
    const envVal = process.env[`HANIMO_FF_${key}`];
    if (envVal === '1' || envVal === 'true') {
      result[key] = true;
    } else if (envVal === '0' || envVal === 'false') {
      result[key] = false;
    }
  }

  flags = result;
}

export function isEnabled(flag: FeatureFlagName): boolean {
  return flags[flag];
}

export function getAllFlags(): FeatureFlags {
  return { ...flags };
}

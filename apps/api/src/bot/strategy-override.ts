import { z } from 'zod';

import { STRATEGY_CONFIG } from '../domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../domain/engine/strategy-config.ts';

// Strict, so a typo in a sweep fails loudly rather than measuring the defaults.
const StrategyOverrideSchema = z
  .object({
    smoothingAlpha: z.number().positive(),
    levelBucketEdges: z.array(z.number().int().nonnegative()),
    rewardBandEdges: z.array(z.number().nonnegative()),
    livesFloor: z.number().int().nonnegative(),
    minimumProbability: z.number().min(0).max(1),
    lifeCostInGold: z.number().nonnegative(),
    turnCostInGold: z.number().nonnegative(),
    levelUpEnabled: z.boolean(),
    levelUpGoldReserve: z.number().nonnegative(),
  } satisfies Record<keyof StrategyConfig, z.ZodType>)
  .partial()
  .strict();

export const applyStrategyOverride = ({ json }: { json: string | undefined }): StrategyConfig => {
  if (json === undefined) {
    return STRATEGY_CONFIG;
  }

  return { ...STRATEGY_CONFIG, ...StrategyOverrideSchema.parse(JSON.parse(json)) };
};

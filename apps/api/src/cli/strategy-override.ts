import { ProbabilityLabelSchema } from '@bigbank-dragon/contracts';
import { z } from 'zod';

import { STRATEGY_CONFIG } from '../managers/bot-manager/index.ts';
import type { StrategyConfig } from '../managers/bot-manager/index.ts';

// Strict, so a typo in a sweep fails loudly rather than measuring the defaults.
const StrategyOverrideSchema = z
  .object({
    smoothingAlpha: z.number().positive(),
    probabilityPrior: z.record(ProbabilityLabelSchema, z.number().min(0).max(1)),
    levelBucketEdges: z.array(z.number().int().nonnegative()),
    rewardBandEdges: z.array(z.number().nonnegative()),
    livesFloor: z.number().int().nonnegative(),
    minimumProbability: z.number().min(0).max(1),
    lifeCostInGold: z.number().nonnegative(),
    turnCostInGold: z.number().nonnegative(),
  } satisfies Record<keyof StrategyConfig, z.ZodType>)
  .partial()
  .strict();

export const applyStrategyOverride = ({ json }: { json: string | undefined }): StrategyConfig => {
  if (json === undefined) {
    return STRATEGY_CONFIG;
  }

  return { ...STRATEGY_CONFIG, ...StrategyOverrideSchema.parse(JSON.parse(json)) };
};

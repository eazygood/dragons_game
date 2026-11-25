import { z } from 'zod';

import { AdSchema } from './ad.ts';
import { DecisionSchema } from './decision.ts';
import { GameStateSchema, RunStatusSchema } from './game.ts';
import { ShopItemSchema } from './shop.ts';

export const GameViewSchema = z.object({ state: GameStateSchema, status: RunStatusSchema });

export type GameView = z.infer<typeof GameViewSchema>;

const AD_VERDICTS = ['recommended', 'viable', 'long_shot', 'unattemptable'] as const;

export const AdVerdictSchema = z.enum(AD_VERDICTS);

export type AdVerdict = z.infer<typeof AdVerdictSchema>;

export const AdAdviceSchema = z.object({
  verdict: AdVerdictSchema,
  estimatedProbability: z.number().min(0).max(1),
  expectedValue: z.number(),
});

export type AdAdvice = z.infer<typeof AdAdviceSchema>;

export const AdvisedAdSchema = AdSchema.extend({ advice: AdAdviceSchema });

export type AdvisedAd = z.infer<typeof AdvisedAdSchema>;

export const TurnViewSchema = z.object({
  game: GameViewSchema,
  board: z.array(AdvisedAdSchema),
  shop: z.array(ShopItemSchema),
  recommendation: DecisionSchema,
});

export type TurnView = z.infer<typeof TurnViewSchema>;

export const MoveResultSchema = z.object({
  game: GameViewSchema,
  success: z.boolean(),
  message: z.string().nullable(),
});

export type MoveResult = z.infer<typeof MoveResultSchema>;

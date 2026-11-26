import { z } from 'zod';

export const DecisionRuleSchema = z.enum([
  'survival_floor',
  // No longer chosen by the engine, but rows stored by earlier experiments still carry it.
  'level_up',
  'best_expected_value',
  'safest_available',
  'no_viable_option',
  'player_choice',
]);

export type DecisionRule = z.infer<typeof DecisionRuleSchema>;

export const ReasoningSchema = z.object({
  rule: DecisionRuleSchema,
  estimatedProbability: z.number().nullable(),
  expectedValue: z.number().nullable(),
  consideredCount: z.number().int().min(0),
});

export type Reasoning = z.infer<typeof ReasoningSchema>;

// A solve always acted on an estimate, and ad_attempts records it, so it is never null.
export const ScoredReasoningSchema = ReasoningSchema.extend({
  estimatedProbability: z.number(),
  expectedValue: z.number(),
});

export type ScoredReasoning = z.infer<typeof ScoredReasoningSchema>;

export const DecisionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('solve'), adId: z.string().min(1), reasoning: ScoredReasoningSchema }),
  z.object({ kind: z.literal('buy'), itemId: z.string().min(1), reasoning: ReasoningSchema }),
  z.object({ kind: z.literal('stop'), reasoning: ReasoningSchema }),
]);

export type Decision = z.infer<typeof DecisionSchema>;

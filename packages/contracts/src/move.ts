import { z } from 'zod';

import { DecisionRuleSchema } from './decision.ts';
import { ProbabilityLabelSchema } from './probability.ts';

// A null rule is a move written before rules were recorded; it is shown, not hidden.
const SolveMoveSchema = z.object({
  kind: z.literal('solve'),
  turn: z.number().int(),
  success: z.boolean(),
  probability: ProbabilityLabelSchema,
  reward: z.number().int(),
  estimatedProbability: z.number(),
  expectedValue: z.number(),
  rule: DecisionRuleSchema.nullable(),
});

const BuyMoveSchema = z.object({
  kind: z.literal('buy'),
  turn: z.number().int(),
  success: z.boolean(),
  itemName: z.string().nullable(),
  cost: z.number().int(),
  rule: DecisionRuleSchema.nullable(),
});

export const MoveSchema = z.discriminatedUnion('kind', [SolveMoveSchema, BuyMoveSchema]);

export const MoveListSchema = z.array(MoveSchema);

export type Move = z.infer<typeof MoveSchema>;

import { z } from 'zod';

import { IdentifierSchema } from './ids.ts';
import { ProbabilityLabelSchema } from './probability.ts';

export const AdSchema = z.object({
  adId: IdentifierSchema,
  message: z.string(),
  reward: z.number(),
  expiresIn: z.number().int(),
  probability: ProbabilityLabelSchema,
  wasEncrypted: z.boolean(),
});

export type Ad = z.infer<typeof AdSchema>;

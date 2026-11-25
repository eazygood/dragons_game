import { z } from 'zod';

import { ProbabilityLabelSchema } from './probability.ts';

export const AdSchema = z.object({
  adId: z.string().min(1),
  message: z.string(),
  reward: z.number(),
  expiresIn: z.number().int(),
  probability: ProbabilityLabelSchema,
  wasEncrypted: z.boolean(),
});

export type Ad = z.infer<typeof AdSchema>;

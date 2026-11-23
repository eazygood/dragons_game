import { z } from 'zod';

import { ProbabilityLabelSchema } from './probability.ts';

const AdFieldsSchema = z.object({
  adId: z.string().min(1),
  message: z.string(),
  reward: z.number(),
  expiresIn: z.number().int(),
});

// `probability` stays a plain string: on an encrypted ad it is still ciphertext.
export const RawAdSchema = AdFieldsSchema.extend({
  encrypted: z.union([z.literal(1), z.literal(2), z.null()]),
  probability: z.string(),
});

export type RawAd = z.infer<typeof RawAdSchema>;

export const AdSchema = AdFieldsSchema.extend({
  probability: ProbabilityLabelSchema,
  wasEncrypted: z.boolean(),
});

export type Ad = z.infer<typeof AdSchema>;

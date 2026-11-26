import { z } from 'zod';

import { IdentifierSchema } from './ids.ts';
import { ProbabilityLabelSchema } from './probability.ts';

// The ad as the upstream sends it. Its id, message and label are ciphertext when
// `encrypted` is set, so only the decoded `AdSchema` holds a validated identifier.
export const RawAdSchema = z.object({
  adId: z.string().min(1),
  message: z.string(),
  reward: z.number(),
  expiresIn: z.number().int(),
  encrypted: z.union([z.literal(1), z.literal(2), z.null()]),
  // Still ciphertext on an encrypted ad, so not yet a ProbabilityLabel.
  probability: z.string(),
});

export type RawAd = z.infer<typeof RawAdSchema>;

export const AdSchema = z.object({
  adId: IdentifierSchema,
  message: z.string(),
  reward: z.number(),
  expiresIn: z.number().int(),
  probability: ProbabilityLabelSchema,
  wasEncrypted: z.boolean(),
});

export type Ad = z.infer<typeof AdSchema>;

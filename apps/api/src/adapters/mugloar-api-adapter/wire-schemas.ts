import { IdentifierSchema, ShopItemSchema } from '@dragons-game/contracts';
import { z } from 'zod';

// Shapes as the live API returns them, not as its published docs claim; see
// "Verified API reference" in docs/agent_docs/architecture.md.

// The server's all-time record, not this game's, and read by nothing. Optional, so a change to
// it cannot fail a solve the server has already played.
const HighScoreWireSchema = z.number().int().optional();

export const GameStartWireSchema = z.object({
  gameId: IdentifierSchema,
  lives: z.number().int(),
  gold: z.number().int(),
  level: z.number().int(),
  score: z.number().int(),
  highScore: HighScoreWireSchema,
  turn: z.number().int(),
});

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

// Per ad, not per list: one ad of an unforeseen shape must not cost the rest of the board.
export const AdListWireSchema = z.array(z.unknown()).transform((entries) =>
  entries.flatMap((entry) => {
    const parsedAd = RawAdSchema.safeParse(entry);

    return parsedAd.success ? [parsedAd.data] : [];
  }),
);

export const SolveWireSchema = z.object({
  success: z.boolean(),
  lives: z.number().int(),
  gold: z.number().int(),
  score: z.number().int(),
  highScore: HighScoreWireSchema,
  turn: z.number().int(),
  message: z.string(),
});

export const ShopWireSchema = z.array(ShopItemSchema);

export const BuyWireSchema = z.object({
  shoppingSuccess: z.boolean(),
  gold: z.number().int(),
  lives: z.number().int(),
  level: z.number().int(),
  turn: z.number().int(),
});

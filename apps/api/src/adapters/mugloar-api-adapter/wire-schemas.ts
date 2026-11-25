import { ShopItemSchema } from '@bigbank-dragon/contracts';
import { z } from 'zod';

// Shapes as the live API returns them, not as its published docs claim; see
// "Verified API reference" in docs/agent_docs/architecture.md.
export const GameStartWireSchema = z.object({
  gameId: z.string().min(1),
  lives: z.number().int(),
  gold: z.number().int(),
  level: z.number().int(),
  score: z.number().int(),
  highScore: z.number().int(),
  turn: z.number().int(),
});

export type GameSnapshot = z.infer<typeof GameStartWireSchema>;

// `probability` stays a plain string: on an encrypted ad it is still ciphertext.
export const RawAdSchema = z.object({
  adId: z.string().min(1),
  message: z.string(),
  reward: z.number(),
  expiresIn: z.number().int(),
  encrypted: z.union([z.literal(1), z.literal(2), z.null()]),
  probability: z.string(),
});

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
  highScore: z.number().int(),
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

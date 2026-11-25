import { GameSnapshotSchema, RawAdSchema, ShopItemSchema } from '@bigbank-dragon/contracts';
import { z } from 'zod';

// Shapes as the live API returns them, not as its published docs claim; see
// "Verified API reference" in docs/agent_docs/architecture.md.
export const GameStartWireSchema = GameSnapshotSchema;

export const AdListWireSchema = z.array(RawAdSchema);

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

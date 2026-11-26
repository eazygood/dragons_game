import { z } from 'zod';

import { IdentifierSchema } from './ids.ts';

export const ShopItemSchema = z.object({
  id: IdentifierSchema,
  name: z.string(),
  cost: z.number().int(),
});

export type ShopItem = z.infer<typeof ShopItemSchema>;

export const HEALING_POTION_ID = 'hpot';

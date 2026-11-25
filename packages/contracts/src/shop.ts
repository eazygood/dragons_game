import { z } from 'zod';

export const ShopItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  cost: z.number().int(),
});

export type ShopItem = z.infer<typeof ShopItemSchema>;

export const HEALING_POTION_ID = 'hpot';

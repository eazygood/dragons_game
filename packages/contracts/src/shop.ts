import { z } from 'zod';

export const ShopItemSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  cost: z.number().int(),
});

export type ShopItem = z.infer<typeof ShopItemSchema>;

export const HEALING_POTION_ID = 'hpot';

// Fallback only (spec §3.5): the live listing is not static across games.
export const SHOP_ITEM_PRIOR: readonly ShopItem[] = [
  { id: HEALING_POTION_ID, name: 'Healing potion', cost: 50 },
  { id: 'cs', name: 'Claw Sharpening', cost: 100 },
  { id: 'gas', name: 'Gasoline', cost: 100 },
  { id: 'wax', name: 'Copper Plating', cost: 100 },
  { id: 'tricks', name: 'Book of Tricks', cost: 100 },
  { id: 'wingpot', name: 'Potion of Stronger Wings', cost: 100 },
  { id: 'ch', name: 'Claw Honing', cost: 300 },
  { id: 'rf', name: 'Rocket Fuel', cost: 300 },
  { id: 'iron', name: 'Iron Plating', cost: 300 },
  { id: 'mtrix', name: 'Book of Megatricks', cost: 300 },
  { id: 'wingpotmax', name: 'Potion of Awesome Wings', cost: 300 },
];

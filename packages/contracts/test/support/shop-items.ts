import { HEALING_POTION_ID } from '../../src/index.ts';
import type { ShopItem } from '../../src/index.ts';

// A shop listing recorded from the live API, for tests only. Production always reads /shop,
// because the listing is not static across games.
export const RECORDED_SHOP_ITEMS: readonly ShopItem[] = [
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

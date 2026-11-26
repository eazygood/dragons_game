import type { Ad, ShopItem } from '@bigbank-dragon/contracts';

import type { OrGameOver } from '../../entities/or-game-over.ts';
import { adRepository, shopItemRepository } from '../../repositories/index.ts';

// What the game offers right now, read from the upstream: ads change every turn, and the shop
// can differ between games.
export const findAds = ({ gameId }: { gameId: string }): Promise<OrGameOver<Ad[]>> =>
  adRepository.mugloar.findMany({ gameId });

export const findShopItems = ({ gameId }: { gameId: string }): Promise<OrGameOver<ShopItem[]>> =>
  shopItemRepository.mugloar.findMany({ gameId });

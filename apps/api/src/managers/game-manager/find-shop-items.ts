import type { ShopItem } from '@bigbank-dragon/contracts';

import type { OrGameOver } from '../../entities/or-game-over.ts';
import { shopItemRepository } from '../../repositories/index.ts';

export const findShopItems = ({ gameId }: { gameId: string }): Promise<OrGameOver<ShopItem[]>> =>
  shopItemRepository.mugloar.findMany({ gameId });

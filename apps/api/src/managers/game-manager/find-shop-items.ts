import type { ShopItem } from '@bigbank-dragon/contracts';

import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { shopItemRepository } from '../../repositories/index.ts';

export const findShopItems = ({
  gameId,
}: {
  gameId: string;
}): Promise<UpstreamResult<ShopItem[]>> => shopItemRepository.mugloar.findMany({ gameId });

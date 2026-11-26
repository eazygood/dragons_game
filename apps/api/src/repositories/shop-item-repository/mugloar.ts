import type { ShopItem } from '@dragons-game/contracts';

import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import { ShopWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';

const findMany = ({ gameId }: { gameId: string }): Promise<OrGameOver<ShopItem[]>> =>
  mugloarApiAdapter.request({
    operation: 'list_shop_items',
    method: 'GET',
    path: `/${encodeURIComponent(gameId)}/shop`,
    schema: ShopWireSchema,
  });

export const mugloarRepository = { findMany };

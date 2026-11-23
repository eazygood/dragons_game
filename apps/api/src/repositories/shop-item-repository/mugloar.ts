import type { ShopItem } from '@bigbank-dragon/contracts';

import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import type { UpstreamResult } from '../../adapters/mugloar-api-adapter/index.ts';
import { ShopWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';

const findMany = ({ gameId }: { gameId: string }): Promise<UpstreamResult<ShopItem[]>> =>
  mugloarApiAdapter.request({
    operation: 'list_shop_items',
    method: 'GET',
    path: `/${encodeURIComponent(gameId)}/shop`,
    schema: ShopWireSchema,
  });

export const mugloarRepository = { findMany };

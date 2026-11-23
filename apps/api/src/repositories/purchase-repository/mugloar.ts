import type { z } from 'zod';

import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import type { UpstreamResult } from '../../adapters/mugloar-api-adapter/index.ts';
import { BuyWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';

export type BuyOutcome = z.infer<typeof BuyWireSchema>;

const createOne = ({
  gameId,
  itemId,
}: {
  gameId: string;
  itemId: string;
}): Promise<UpstreamResult<BuyOutcome>> =>
  mugloarApiAdapter.request({
    operation: 'buy_item',
    method: 'POST',
    path: `/${encodeURIComponent(gameId)}/shop/buy/${encodeURIComponent(itemId)}`,
    schema: BuyWireSchema,
  });

export const mugloarRepository = { createOne };

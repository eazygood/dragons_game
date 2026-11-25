import { mugloarApiAdapter } from '../../adapters/mugloar-api-adapter/index.ts';
import { BuyWireSchema } from '../../adapters/mugloar-api-adapter/wire-schemas.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { BuyOutcome } from '../../entities/purchase.ts';

const BuyOutcomeSchema = BuyWireSchema.transform(
  ({ shoppingSuccess, lives, gold, level, turn }): BuyOutcome => ({
    success: shoppingSuccess,
    lives,
    gold,
    level,
    turn,
  }),
);

const createOne = ({
  gameId,
  itemId,
}: {
  gameId: string;
  itemId: string;
}): Promise<OrGameOver<BuyOutcome>> =>
  mugloarApiAdapter.request({
    operation: 'buy_item',
    method: 'POST',
    path: `/${encodeURIComponent(gameId)}/shop/buy/${encodeURIComponent(itemId)}`,
    schema: BuyOutcomeSchema,
  });

export const mugloarRepository = { createOne };

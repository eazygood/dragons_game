import type { Ad, Decision, GameState, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { GameRun } from '../entities/game-run.ts';
import type { TurnResult } from '../entities/turn-result.ts';
import type { UpstreamResult } from '../entities/upstream-result.ts';
import { buyItem, solveAd } from '../managers/game-manager/index.ts';

type TurnContext = { db: Knex; run: GameRun; state: GameState };

export const execute = ({
  context,
  decision,
  board,
  shop,
}: {
  context: TurnContext;
  decision: Exclude<Decision, { kind: 'stop' }>;
  board: Ad[];
  shop: ShopItem[];
}): Promise<UpstreamResult<TurnResult>> => {
  if (decision.kind === 'solve') {
    const ad = board.find((candidate) => candidate.adId === decision.adId);

    if (!ad) {
      throw new Error(`Decision names ad ${decision.adId}, which is not on the board`);
    }

    return solveAd({ ...context, ad, reasoning: decision.reasoning });
  }

  const item = shop.find((candidate) => candidate.id === decision.itemId);

  if (!item) {
    throw new Error(`Decision names item ${decision.itemId}, which is not in the shop`);
  }

  return buyItem({ ...context, item });
};

import type { GameState, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { MugloarClient, UpstreamResult } from '../../adapters/mugloar-api-adapter/index.ts';
import type { GameRun } from '../../entities/game-run.ts';
import { purchaseRepository } from '../../repositories/index.ts';
import { persistTurn } from './persist-turn.ts';

export const buyItem = async ({
  db,
  client,
  run,
  state,
  item,
}: {
  db: Knex;
  client: MugloarClient;
  run: GameRun;
  state: GameState;
  item: ShopItem;
}): Promise<UpstreamResult<GameState>> => {
  const result = await client.buyItem({ gameId: run.gameId, itemId: item.id });

  if (result.status === 'game_over') {
    return result;
  }

  const outcome = result.value;
  // A failed purchase still burns a turn, but must not move the level.
  const next: GameState = {
    ...state,
    lives: outcome.lives,
    gold: outcome.gold,
    turn: outcome.turn,
    dragonLevel: outcome.shoppingSuccess ? outcome.level : state.dragonLevel,
  };

  await persistTurn({
    db,
    run,
    state: next,
    record: (trx) =>
      purchaseRepository.createOne({
        db: trx,
        purchase: {
          gameRunId: run.id,
          itemId: item.id,
          cost: item.cost,
          turn: outcome.turn,
          success: outcome.shoppingSuccess,
          createdAt: new Date(),
        },
      }),
  });

  return { status: 'ok', value: next };
};

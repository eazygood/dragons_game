import type { GameState, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { UpstreamResult } from '../../adapters/mugloar-api-adapter/index.ts';
import type { GameRun } from '../../entities/game-run.ts';
import { purchaseRepository } from '../../repositories/index.ts';
import { saveStateWithRecord } from './save-state-with-record.ts';

export const buyItem = async ({
  db,
  run,
  state,
  item,
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
  item: ShopItem;
}): Promise<UpstreamResult<GameState>> => {
  const result = await purchaseRepository.mugloar.createOne({
    gameId: run.gameId,
    itemId: item.id,
  });

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

  await saveStateWithRecord({
    db,
    run,
    state: next,
    writeRecord: (trx) =>
      purchaseRepository.db.createOne({
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

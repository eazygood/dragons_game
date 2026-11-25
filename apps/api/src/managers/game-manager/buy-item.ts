import type { GameState, Reasoning, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { TurnResult } from '../../entities/turn-result.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { purchaseRepository } from '../../repositories/index.ts';
import { saveStateWithRecord } from './save-state-with-record.ts';

export const buyItem = async ({
  db,
  run,
  state,
  item,
  reasoning,
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
  item: ShopItem;
  reasoning: Reasoning;
}): Promise<UpstreamResult<TurnResult>> => {
  const buyResult = await purchaseRepository.mugloar.createOne({
    gameId: run.gameId,
    itemId: item.id,
  });

  if (buyResult.status === 'game_over') {
    return buyResult;
  }

  const outcome = buyResult.value;
  // A failed purchase still burns a turn, but must not move the level.
  const nextState: GameState = {
    ...state,
    lives: outcome.lives,
    gold: outcome.gold,
    turn: outcome.turn,
    dragonLevel: outcome.success ? outcome.level : state.dragonLevel,
  };

  const turnResult: TurnResult = { state: nextState, success: outcome.success, message: null };

  await saveStateWithRecord({
    db,
    run,
    turnResult,
    writeRecord: (trx) =>
      purchaseRepository.db.createOne({
        db: trx,
        purchase: {
          gameRunId: run.id,
          itemId: item.id,
          itemName: item.name,
          rule: reasoning.rule,
          cost: item.cost,
          turn: outcome.turn,
          success: outcome.success,
          createdAt: new Date(),
        },
      }),
  });

  return { status: 'ok', value: turnResult };
};

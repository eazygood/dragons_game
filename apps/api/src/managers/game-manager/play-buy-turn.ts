import type { Reasoning, ShopItem } from '@dragons-game/contracts';

import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { SavedTurn } from '../../entities/turn-result.ts';
import { purchaseRepository } from '../../repositories/index.ts';
import { playMove } from './play-move.ts';
import type { MoveContext } from './play-move.ts';

export const playBuyTurn = ({
  context,
  item,
  reasoning,
}: {
  context: MoveContext;
  item: ShopItem;
  reasoning: Reasoning;
}): Promise<OrGameOver<SavedTurn>> => {
  const { run, state } = context;

  return playMove({
    context,
    callUpstream: () =>
      purchaseRepository.mugloar.createOne({ gameId: run.gameId, itemId: item.id }),
    // A failed purchase still burns a turn, but must not move the level.
    toTurnResult: ({ outcome }) => ({
      state: {
        ...state,
        lives: outcome.lives,
        gold: outcome.gold,
        turn: outcome.turn,
        dragonLevel: outcome.success ? outcome.level : state.dragonLevel,
      },
      success: outcome.success,
      message: null,
    }),
    writeRecord: ({ outcome, trx }) =>
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
};

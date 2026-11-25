import type { Reasoning } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import type { PlayerMove } from '../../entities/turn-result.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { InsufficientGoldError, ShopItemNotFoundError } from '../../errors/errors.ts';
import { buyItem } from './buy-item.ts';
import { recordGameOver } from './record-game-over.ts';
import { findPlayableRun } from './find-run.ts';
import { findShopItems } from './find-shop-items.ts';
import { withGameLock } from './game-lock.ts';
import { keepPlayingOnPersistenceFailure } from './keep-playing.ts';
import { applyMoveOutcome } from './apply-move-outcome.ts';
import { stateFromRun } from './state-patch.ts';

export const buyPlayerItem = ({
  db,
  gameId,
  itemId,
  logger,
}: {
  db: Knex;
  gameId: string;
  itemId: string;
  logger: Logger;
}): Promise<UpstreamResult<PlayerMove>> =>
  withGameLock({
    gameId,
    task: async () => {
      const playableRunResult = await findPlayableRun({ db, gameId });

      if (playableRunResult.status === 'game_over') {
        return playableRunResult;
      }

      const run = playableRunResult.value;
      const shopResult = await findShopItems({ gameId });

      if (shopResult.status === 'game_over') {
        await recordGameOver({ db, run, logger });
        return shopResult;
      }

      const item = shopResult.value.find((candidate) => candidate.id === itemId);

      if (!item) {
        throw new ShopItemNotFoundError({ message: `Item ${itemId} is not in the shop` });
      }

      const state = stateFromRun({ run });

      // A purchase the upstream refuses still burns a turn, so refuse it here first.
      if (state.gold < item.cost) {
        throw new InsufficientGoldError({
          message: `${item.name} costs ${item.cost} gold; you have ${state.gold}`,
        });
      }

      const reasoning: Reasoning = {
        rule: 'player_choice',
        estimatedProbability: null,
        expectedValue: null,
        consideredCount: shopResult.value.length,
      };
      const pendingTurn = buyItem({ db, run, state, item, reasoning });
      const playedTurn = await keepPlayingOnPersistenceFailure({ pendingTurn, logger });

      return applyMoveOutcome({ db, run, playedTurn, logger });
    },
  });

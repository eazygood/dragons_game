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
      const runLookup = await findPlayableRun({ db, gameId });

      if (runLookup.status === 'game_over') {
        return runLookup;
      }

      const run = runLookup.value;
      const shop = await findShopItems({ gameId });

      if (shop.status === 'game_over') {
        await recordGameOver({ db, run, logger });
        return shop;
      }

      const item = shop.value.find((candidate) => candidate.id === itemId);

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
        consideredCount: shop.value.length,
      };
      const action = buyItem({ db, run, state, item, reasoning });
      const result = await keepPlayingOnPersistenceFailure({ action, logger });

      return applyMoveOutcome({ db, run, result, logger });
    },
  });

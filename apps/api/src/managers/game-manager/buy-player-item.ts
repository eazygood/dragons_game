import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import type { PlayerMove } from '../../entities/turn-result.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { InsufficientGoldError, ShopItemNotFoundError } from '../../errors/errors.ts';
import { buyItem } from './buy-item.ts';
import { endRun } from './end-run.ts';
import { findPlayableRun } from './find-run.ts';
import { findShopItems } from './find-shop-items.ts';
import { withGameLock } from './game-lock.ts';
import { keepPlayingOnPersistenceFailure } from './keep-playing.ts';
import { settleMove } from './settle-move.ts';
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
      const playableRun = await findPlayableRun({ db, gameId });

      if (playableRun.status === 'game_over') {
        return playableRun;
      }

      const run = playableRun.value;
      const shop = await findShopItems({ gameId });

      if (shop.status === 'game_over') {
        await endRun({ db, run, logger });
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

      const action = buyItem({ db, run, state, item });
      const result = await keepPlayingOnPersistenceFailure({ action, logger });

      return settleMove({ db, run, result, logger });
    },
  });

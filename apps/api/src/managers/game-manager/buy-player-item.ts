import type { Reasoning } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { PlayerMove } from '../../entities/turn-result.ts';
import { InsufficientGoldError, ShopItemNotFoundError } from '../../errors/errors.ts';
import { findShopItems } from './board.ts';
import { playBuyTurn } from './play-buy-turn.ts';
import { withPlayerTurn } from './with-player-turn.ts';

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
}): Promise<OrGameOver<PlayerMove>> =>
  withPlayerTurn({
    db,
    gameId,
    logger,
    findListing: findShopItems,
    playTurn: ({ context, listing: shop }) => {
      const item = shop.find((candidate) => candidate.id === itemId);

      if (!item) {
        throw new ShopItemNotFoundError({ message: `Item ${itemId} is not in the shop` });
      }

      const { gold } = context.state;

      // A purchase the upstream refuses still burns a turn, so refuse it here first.
      if (gold < item.cost) {
        throw new InsufficientGoldError({
          message: `${item.name} costs ${item.cost} gold; you have ${gold}`,
        });
      }

      const reasoning: Reasoning = {
        rule: 'player_choice',
        estimatedProbability: null,
        expectedValue: null,
        consideredCount: shop.length,
      };

      return playBuyTurn({ context, item, reasoning });
    },
  });

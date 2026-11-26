import type { MoveResult } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import { buyPlayerItem } from '../../managers/game-manager/index.ts';
import { toMoveResult } from './move-result.ts';

export const buyItem = async ({
  db,
  gameId,
  itemId,
  logger,
}: {
  db: Knex;
  gameId: string;
  itemId: string;
  logger: Logger;
}): Promise<OrGameOver<MoveResult>> =>
  toMoveResult({ playerMoveResult: await buyPlayerItem({ db, gameId, itemId, logger }) });

import type { MoveResult } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { buyPlayerItem } from '../../managers/game-manager/index.ts';
import { toMoveResult } from './game-view.ts';

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
}): Promise<UpstreamResult<MoveResult>> =>
  toMoveResult({ move: await buyPlayerItem({ db, gameId, itemId, logger }) });

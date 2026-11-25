import type { MoveResult } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { solvePlayerAd } from '../../managers/game-manager/index.ts';
import { toMoveResult } from './game-view.ts';

export const solveAd = async ({
  db,
  gameId,
  adId,
  logger,
}: {
  db: Knex;
  gameId: string;
  adId: string;
  logger: Logger;
}): Promise<UpstreamResult<MoveResult>> =>
  toMoveResult({ playerMoveResult: await solvePlayerAd({ db, gameId, adId, logger }) });

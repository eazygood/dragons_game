import type { MoveResult } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
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
}): Promise<OrGameOver<MoveResult>> =>
  toMoveResult({ playerMoveResult: await solvePlayerAd({ db, gameId, adId, logger }) });

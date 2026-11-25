import type { AdvisedAd, Decision, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import { adviseBoard } from '../../domain/engine/advise.ts';
import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { GameRun } from '../../entities/game-run.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { loadCalibration } from '../calibration-manager/index.ts';
import {
  recordGameOver,
  findAds,
  findPlayableRun,
  findShopItems,
  stateFromRun,
} from '../game-manager/index.ts';

type PlayerTurn = {
  run: GameRun;
  board: AdvisedAd[];
  shop: ShopItem[];
  recommendation: Decision;
};

// The advisor reads all history (benchmarkId null): a human game has no benchmark scope.
export const adviseTurn = async ({
  db,
  gameId,
  logger,
}: {
  db: Knex;
  gameId: string;
  logger: Logger;
}): Promise<UpstreamResult<PlayerTurn>> => {
  const playableRunResult = await findPlayableRun({ db, gameId });

  if (playableRunResult.status === 'game_over') {
    return playableRunResult;
  }

  const run = playableRunResult.value;
  const [boardResult, shopResult] = await Promise.all([
    findAds({ gameId }),
    findShopItems({ gameId }),
  ]);

  if (boardResult.status === 'game_over' || shopResult.status === 'game_over') {
    await recordGameOver({ db, run, logger });
    return { status: 'game_over' };
  }

  const config = STRATEGY_CONFIG;
  const calibration = await loadCalibration({
    db,
    strategy: 'calibrated',
    config,
    logger,
    benchmarkId: null,
  });
  const { recommendation, ads } = adviseBoard({
    state: stateFromRun({ run }),
    board: boardResult.value,
    shop: shopResult.value,
    calibration,
    config,
  });

  return { status: 'ok', value: { run, board: ads, shop: shopResult.value, recommendation } };
};

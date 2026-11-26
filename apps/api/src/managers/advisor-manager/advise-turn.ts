import type { AdvisedAd, Decision, ShopItem } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { adviseBoard } from '../../domain/engine/advise.ts';
import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import { loadPlayerCalibration } from '../calibration-manager/index.ts';
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

export const adviseTurn = async ({
  db,
  gameId,
  logger,
}: {
  db: Knex;
  gameId: string;
  logger: Logger;
}): Promise<OrGameOver<PlayerTurn>> => {
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

  const calibration = await loadPlayerCalibration({ db, logger });
  const { recommendation, ads } = adviseBoard({
    state: stateFromRun({ run }),
    board: boardResult.value,
    shop: shopResult.value,
    calibration,
    config: STRATEGY_CONFIG,
  });

  return { status: 'ok', value: { run, board: ads, shop: shopResult.value, recommendation } };
};

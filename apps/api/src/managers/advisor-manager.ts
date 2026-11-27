import type { AdvisedAd, Decision, ShopItem } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import { adviseBoard } from '../engine/advise.ts';
import { STRATEGY_CONFIG } from '../engine/strategy-config.ts';
import type { GameRun } from '../entities/game-run.ts';
import type { Logger, OrGameOver } from '../types.ts';
import * as calibrationManager from './calibration-manager.ts';
import * as gameManager from './game-manager/index.ts';

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
  const playableRunResult = await gameManager.findPlayableRun({ db, gameId });

  if (playableRunResult.status === 'game_over') {
    return playableRunResult;
  }

  const run = playableRunResult.value;
  const [boardResult, shopResult] = await Promise.all([
    gameManager.findAds({ gameId, logger }),
    gameManager.findShopItems({ gameId }),
  ]);

  if (boardResult.status === 'game_over' || shopResult.status === 'game_over') {
    await gameManager.recordGameOver({ db, run, logger });
    return { status: 'game_over' };
  }

  const calibration = await calibrationManager.loadPlayerCalibration({ db, logger });
  const { recommendation, ads } = adviseBoard({
    state: gameManager.stateFromRun({ run }),
    board: boardResult.value,
    shop: shopResult.value,
    calibration,
    config: STRATEGY_CONFIG,
  });

  return { status: 'ok', value: { run, board: ads, shop: shopResult.value, recommendation } };
};

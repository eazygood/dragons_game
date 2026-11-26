import type { ShopItem } from '@dragons-game/contracts';
import { RECORDED_SHOP_ITEMS } from '@dragons-game/contracts/test-support';
import type { Knex } from 'knex';

import { priorCalibration } from '../../src/engine/calibration.ts';
import { loadCalibration } from '../../src/managers/calibration-manager.ts';
import { startGameRun } from '../../src/managers/game-manager.ts';
import { playTurn } from '../../src/managers/bot-manager.ts';
import type { BotGameContext, BotRunProgress } from '../../src/managers/bot-manager.ts';
import { BOT_CONFIG, botLogger } from './bot-run.ts';

export type BotTurnFixture = {
  context: BotGameContext;
  shop: ShopItem[];
  progress: BotRunProgress;
};

// A calibrated run just started, with the pieces `playTurn` takes: what stays fixed for the
// game and the progress a bot carries into its first turn.
export const startCalibratedRun = async ({
  db,
  calibration,
}: {
  db: Knex;
  calibration?: BotRunProgress['calibration'];
}): Promise<BotTurnFixture> => {
  const { run, state } = await startGameRun({ db, strategy: 'calibrated' });

  return {
    context: {
      db,
      run,
      strategy: 'calibrated',
      calibrationBenchmarkId: null,
      config: BOT_CONFIG,
      logger: botLogger,
    },
    shop: [...RECORDED_SHOP_ITEMS],
    progress: {
      state,
      turns: 0,
      calibration: calibration ?? priorCalibration({ config: BOT_CONFIG }),
    },
  };
};

export const readStoredCalibration = ({ db }: { db: Knex }) =>
  loadCalibration({
    db,
    strategy: 'calibrated',
    config: BOT_CONFIG,
    logger: botLogger,
    benchmarkId: null,
  });

// Plays turns until the game ends, the way `playGame` does without its error handling, and
// returns the progress the bot ends with.
export const playToTheEnd = async ({ context, shop, progress }: BotTurnFixture) => {
  let current = progress;
  let outcome = await playTurn({ context, shop, progress: current });

  while (outcome.status === 'played') {
    current = outcome.progress;
    outcome = await playTurn({ context, shop, progress: current });
  }

  return outcome.progress;
};

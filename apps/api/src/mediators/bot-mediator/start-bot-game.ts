import type { GameView } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import { playGame } from '../../managers/bot-manager/index.ts';
import { startGame } from '../../managers/game-manager/index.ts';
import { toGameView } from '../game-mediator/game-view.ts';

export const startBotGame = async ({
  db,
  logger,
}: {
  db: Knex;
  logger: Logger;
}): Promise<GameView> => {
  const strategy = 'calibrated';
  const { run, state } = await startGame({ db, strategy });

  // Nothing awaits the game: it outlives the request. playGame abandons the run before it
  // rejects, so this catch only has to report the failure.
  void playGame({ db, run, state, strategy, calibrationBenchmarkId: null, logger }).catch(
    (error: unknown) => logger.warn({ err: error, gameId: run.gameId }, 'bot game failed'),
  );

  return toGameView({ run });
};

import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import type { GameRun } from '../../entities/game-run.ts';
import { finishRun } from './finish-run.ts';
import { runState } from './state-patch.ts';

// The game is over upstream whatever happens here; a failed write must not turn
// that into a 500 for the player.
export const endRun = async ({
  db,
  run,
  state = runState({ run }),
  logger,
}: {
  db: Knex;
  run: GameRun;
  state?: GameState;
  logger: Logger;
}): Promise<void> => {
  try {
    await finishRun({ db, run, state, status: 'game_over' });
  } catch (error) {
    logger.warn({ err: error, gameId: run.gameId }, 'could not mark run as game over');
  }
};

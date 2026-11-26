import type { GameState } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import { finishRun } from './finish-run.ts';
import { stateFromRun } from './run-state.ts';

// The game is over upstream whatever happens here; a failed write must not turn
// that into a 500 for the player.
export const recordGameOver = async ({
  db,
  run,
  state = stateFromRun({ run }),
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

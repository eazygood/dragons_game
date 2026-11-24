import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import type { GameRun } from '../../entities/game-run.ts';
import type { PlayerMove, TurnResult } from '../../entities/turn-result.ts';
import type { UpstreamResult } from '../../entities/upstream-result.ts';
import { recordGameOver } from './record-game-over.ts';

// A move that took the last life returns 200 upstream; the next call would be a 410.
export const applyMoveOutcome = async ({
  db,
  run,
  result,
  logger,
}: {
  db: Knex;
  run: GameRun;
  result: UpstreamResult<TurnResult>;
  logger: Logger;
}): Promise<UpstreamResult<PlayerMove>> => {
  if (result.status === 'game_over') {
    await recordGameOver({ db, run, logger });
    return result;
  }

  if (result.value.state.lives <= 0) {
    await recordGameOver({ db, run, state: result.value.state, logger });
    return { status: 'ok', value: { ...result.value, status: 'game_over' } };
  }

  return { status: 'ok', value: { ...result.value, status: 'active' } };
};

import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { PlayerMove, TurnResult } from '../../entities/turn-result.ts';
import { isOutOfLives } from './out-of-lives.ts';
import { recordGameOver } from './record-game-over.ts';

export const applyMoveOutcome = async ({
  db,
  run,
  playedTurn,
  logger,
}: {
  db: Knex;
  run: GameRun;
  playedTurn: OrGameOver<TurnResult>;
  logger: Logger;
}): Promise<OrGameOver<PlayerMove>> => {
  if (playedTurn.status === 'game_over') {
    await recordGameOver({ db, run, logger });
    return playedTurn;
  }

  if (isOutOfLives({ state: playedTurn.value.state })) {
    await recordGameOver({ db, run, state: playedTurn.value.state, logger });
    return { status: 'ok', value: { ...playedTurn.value, status: 'game_over' } };
  }

  return { status: 'ok', value: { ...playedTurn.value, status: 'active' } };
};

import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { PlayerMove, SavedTurn } from '../../entities/turn-result.ts';
import { recordGameOver } from './record-game-over.ts';
import { isOutOfLives } from './run-state.ts';

export const applyMoveOutcome = async ({
  db,
  run,
  playedTurn,
  logger,
}: {
  db: Knex;
  run: GameRun;
  playedTurn: OrGameOver<SavedTurn>;
  logger: Logger;
}): Promise<OrGameOver<PlayerMove>> => {
  if (playedTurn.status === 'game_over') {
    await recordGameOver({ db, run, logger });
    return playedTurn;
  }

  const { turn } = playedTurn.value;

  if (isOutOfLives({ state: turn.state })) {
    await recordGameOver({ db, run, state: turn.state, logger });
    return { status: 'ok', value: { ...turn, status: 'game_over' } };
  }

  return { status: 'ok', value: { ...turn, status: 'active' } };
};

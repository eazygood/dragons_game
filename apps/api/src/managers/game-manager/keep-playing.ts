import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { TurnResult } from '../../entities/turn-result.ts';
import { PersistenceFailedError } from '../../errors/errors.ts';
import { gameRunRepository } from '../../repositories/index.ts';
import { statePatch } from './run-state.ts';

// The bot outlives this error: the upstream turn already happened, and the bot
// carries the state in memory, so losing the local record must not end the real game.
export const keepPlayingOnPersistenceFailure = async ({
  pendingTurn,
  logger,
}: {
  pendingTurn: Promise<OrGameOver<TurnResult>>;
  logger: Logger;
}): Promise<OrGameOver<TurnResult>> => {
  try {
    return await pendingTurn;
  } catch (error) {
    if (!(error instanceof PersistenceFailedError)) {
      throw error;
    }

    logger.warn(
      { err: error, turn: error.turnResult.state.turn },
      'turn not persisted; playing on',
    );
    return { status: 'ok', value: error.turnResult };
  }
};

// A player's next move rebuilds state from the row, so a lost write would carry a stale
// dragon level forward for good. The record may go, but the state must land or fail loudly.
export const saveStateOnPersistenceFailure = async ({
  db,
  run,
  pendingTurn,
  logger,
}: {
  db: Knex;
  run: GameRun;
  pendingTurn: Promise<OrGameOver<TurnResult>>;
  logger: Logger;
}): Promise<OrGameOver<TurnResult>> => {
  try {
    return await pendingTurn;
  } catch (error) {
    if (!(error instanceof PersistenceFailedError)) {
      throw error;
    }

    logger.warn(
      { err: error, turn: error.turnResult.state.turn },
      'turn record not persisted; saving state only',
    );

    try {
      await gameRunRepository.db.updateOne({
        db,
        id: run.id,
        patch: statePatch({ state: error.turnResult.state }),
      });
    } catch (fallbackError) {
      throw new PersistenceFailedError({
        message: `Could not save the state after turn ${error.turnResult.state.turn} of game ${run.gameId}`,
        cause: fallbackError,
        turnResult: error.turnResult,
      });
    }

    return { status: 'ok', value: error.turnResult };
  }
};

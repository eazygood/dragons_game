import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { withTransaction } from '../../adapters/mysql-adapter.ts';
import type { GameRun } from '../../entities/game-run.ts';
import { PersistenceFailedError } from '../../errors/errors.ts';
import { gameRunRepository } from '../../repositories/index.ts';

// The live state goes first, so a failing record write rolls it back with it.
export const persistTurn = async ({
  db,
  run,
  state,
  record,
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
  record: (trx: Knex.Transaction) => Promise<unknown>;
}): Promise<void> => {
  try {
    await withTransaction({
      db,
      callback: async (trx) => {
        await gameRunRepository.updateOne({
          db: trx,
          id: run.id,
          patch: {
            lives: state.lives,
            gold: state.gold,
            dragonLevel: state.dragonLevel,
            turn: state.turn,
            score: state.score,
          },
        });
        await record(trx);
      },
    });
  } catch (cause) {
    throw new PersistenceFailedError({
      message: `Could not record turn ${state.turn} of game ${run.gameId}`,
      cause,
      state,
    });
  }
};

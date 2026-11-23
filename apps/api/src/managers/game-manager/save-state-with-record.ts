import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { withTransaction } from '../../adapters/mysql-adapter.ts';
import type { GameRun } from '../../entities/game-run.ts';
import { PersistenceFailedError } from '../../errors/errors.ts';
import { gameRunRepository } from '../../repositories/index.ts';

// One transaction for the run's live state and the turn's record (ad attempt or
// purchase), so a failed record write rolls the state back and the two never disagree.
export const saveStateWithRecord = async ({
  db,
  run,
  state,
  writeRecord,
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
  writeRecord: (trx: Knex.Transaction) => Promise<unknown>;
}): Promise<void> => {
  try {
    await withTransaction({
      db,
      callback: async (trx) => {
        await gameRunRepository.db.updateOne({
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
        await writeRecord(trx);
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

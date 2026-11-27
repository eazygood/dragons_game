import type { GameState } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import { withTransaction } from '../../adapters/mysql-adapter.ts';
import type { GameRun } from '../../entities/game-run.ts';
import { PersistenceFailedError } from '../../errors/errors.ts';
import * as gameRunRepository from '../../repositories/game-run-repository.ts';
import type { Logger } from '../../types.ts';
import { statePatch } from './game-state.ts';

// `message` is the upstream's solve message; a purchase has none.
export type TurnResult = { state: GameState; success: boolean; message: string | null };

// `persisted` is false when the turn's record could not be written: the upstream turn
// still happened, so the caller decides what a lost record means for it.
export type SavedTurn = { turn: TurnResult; persisted: boolean };

// What a lost record means depends on who plays. A bot carries its state in memory, so it
// logs and plays on. A player's next move rebuilds state from the row, so a lost write would
// carry a stale dragon level forward for good: the record may go, but the state must land.
export type OnPersistFailure = 'keep_playing' | 'save_state_only';

type SaveInput = {
  db: Knex;
  run: GameRun;
  turnResult: TurnResult;
  logger: Logger;
};

const settleLostRecord = async ({
  db,
  run,
  turnResult,
  logger,
  cause,
  onPersistFailure,
}: SaveInput & { cause: unknown; onPersistFailure: OnPersistFailure }): Promise<SavedTurn> => {
  const { turn } = turnResult.state;
  const lostRecord: SavedTurn = { turn: turnResult, persisted: false };

  if (onPersistFailure === 'keep_playing') {
    logger.warn({ err: cause, turn }, 'turn not persisted; playing on');
    return lostRecord;
  }

  logger.warn({ err: cause, turn }, 'turn record not persisted; saving state only');

  try {
    await gameRunRepository.updateOne({
      db,
      id: run.id,
      patch: statePatch({ state: turnResult.state }),
    });
  } catch (fallbackError) {
    throw new PersistenceFailedError({
      message: `Could not save the state after turn ${turn} of game ${run.gameId}`,
      cause: fallbackError,
    });
  }

  return lostRecord;
};

// One transaction for the run's live state and the turn's record (ad attempt or
// purchase), so a failed record write rolls the state back and the two never disagree.
export const saveStateWithRecord = async ({
  writeRecord,
  onPersistFailure,
  ...input
}: SaveInput & {
  writeRecord: (trx: Knex.Transaction) => Promise<unknown>;
  onPersistFailure: OnPersistFailure;
}): Promise<SavedTurn> => {
  const { db, run, turnResult } = input;

  try {
    await withTransaction({
      db,
      callback: async (trx) => {
        await gameRunRepository.updateOne({
          db: trx,
          id: run.id,
          patch: statePatch({ state: turnResult.state }),
        });
        await writeRecord(trx);
      },
    });
  } catch (cause) {
    return settleLostRecord({ ...input, cause, onPersistFailure });
  }

  return { turn: turnResult, persisted: true };
};

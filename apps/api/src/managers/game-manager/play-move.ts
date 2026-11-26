import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import type { Logger } from '../../entities/logger.ts';
import type { OrGameOver } from '../../entities/or-game-over.ts';
import type { SavedTurn, TurnResult } from '../../entities/turn-result.ts';
import { saveStateWithRecord } from './save-state-with-record.ts';
import type { OnPersistFailure } from './save-state-with-record.ts';

export type MoveContext = {
  db: Knex;
  run: GameRun;
  state: GameState;
  logger: Logger;
  onPersistFailure: OnPersistFailure;
};

// The shape every move shares: ask the upstream, turn its answer into the next state, and
// save that state with the move's record. Only what a move reports and records differs.
export const playMove = async <Outcome>({
  context,
  callUpstream,
  toTurnResult,
  writeRecord,
}: {
  context: MoveContext;
  callUpstream: () => Promise<OrGameOver<Outcome>>;
  toTurnResult: ({ outcome }: { outcome: Outcome }) => TurnResult;
  writeRecord: ({ outcome, trx }: { outcome: Outcome; trx: Knex.Transaction }) => Promise<unknown>;
}): Promise<OrGameOver<SavedTurn>> => {
  const upstreamResult = await callUpstream();

  if (upstreamResult.status === 'game_over') {
    return upstreamResult;
  }

  const { db, run, logger, onPersistFailure } = context;
  const { value: outcome } = upstreamResult;
  const savedTurn = await saveStateWithRecord({
    db,
    run,
    logger,
    onPersistFailure,
    turnResult: toTurnResult({ outcome }),
    writeRecord: (trx) => writeRecord({ outcome, trx }),
  });

  return { status: 'ok', value: savedTurn };
};

import type { GameState, RunStatus } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import type { GameRun, NewGameRun, StrategyName } from '../../entities/game-run.ts';
import { GameNotFoundError, GameNotPlayableError } from '../../errors/errors.ts';
import * as gameRepository from '../../repositories/game-repository/index.ts';
import type { Logger, OrGameOver } from '../../types.ts';
import { stateFromRun, statePatch } from './game-state.ts';

export const findRun = async ({ db, gameId }: { db: Knex; gameId: string }): Promise<GameRun> => {
  const run = await gameRepository.db.findOne({ db, gameId });

  if (!run) {
    throw new GameNotFoundError({ message: `Game ${gameId} not found` });
  }

  return run;
};

export const findBenchmarkRuns = ({
  db,
  benchmarkId,
}: {
  db: Knex;
  benchmarkId: string;
}): Promise<GameRun[]> => gameRepository.db.findMany({ db, benchmarkId });

// A finished run answers game over without asking the upstream, which would say 410 anyway.
export const findPlayableRun = async ({
  db,
  gameId,
}: {
  db: Knex;
  gameId: string;
}): Promise<OrGameOver<GameRun>> => {
  const run = await findRun({ db, gameId });

  if (run.strategy !== 'manual') {
    throw new GameNotPlayableError({ message: `Game ${gameId} is played by the bot` });
  }

  if (run.status !== 'active') {
    return { status: 'game_over' };
  }

  return { status: 'ok', value: run };
};

export const startGameRun = async ({
  db,
  strategy,
  benchmarkId = null,
}: {
  db: Knex;
  strategy: StrategyName;
  benchmarkId?: string | null;
}): Promise<{ run: GameRun; state: GameState }> => {
  const state = await gameRepository.mugloar.startGame();
  const gameRun: NewGameRun = {
    ...state,
    strategy,
    benchmarkId,
    status: 'active',
    startedAt: new Date(),
    endedAt: null,
  };
  const id = await gameRepository.db.createOne({ db, gameRun });

  return { run: { ...gameRun, id }, state };
};

export const finishRun = async ({
  db,
  run,
  state,
  status,
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
  status: Exclude<RunStatus, 'active'>;
}): Promise<void> => {
  await gameRepository.db.updateOne({
    db,
    id: run.id,
    patch: { ...statePatch({ state }), status, endedAt: new Date() },
  });
};

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

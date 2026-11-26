import type { GameState, StrategyName } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import type { GameRun, NewGameRun } from '../../entities/game-run.ts';
import { gameRunRepository } from '../../repositories/index.ts';

export const startGameRun = async ({
  db,
  strategy,
  benchmarkId = null,
}: {
  db: Knex;
  strategy: StrategyName;
  benchmarkId?: string | null;
}): Promise<{ run: GameRun; state: GameState }> => {
  const snapshot = await gameRunRepository.mugloar.createOne();
  const state: GameState = {
    gameId: snapshot.gameId,
    lives: snapshot.lives,
    gold: snapshot.gold,
    dragonLevel: snapshot.level,
    turn: snapshot.turn,
    score: snapshot.score,
  };
  const gameRun: NewGameRun = {
    ...state,
    strategy,
    benchmarkId,
    status: 'active',
    startedAt: new Date(),
    endedAt: null,
  };
  const id = await gameRunRepository.db.createOne({ db, gameRun });

  return { run: { ...gameRun, id }, state };
};

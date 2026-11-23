import type { GameState, StrategyName } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { MugloarClient } from '../../adapters/mugloar-api-adapter/index.ts';
import type { GameRun, NewGameRun } from '../../entities/game-run.ts';
import { gameRunRepository } from '../../repositories/index.ts';

export const startGame = async ({
  db,
  client,
  strategy,
  benchmarkId = null,
}: {
  db: Knex;
  client: MugloarClient;
  strategy: StrategyName;
  benchmarkId?: string | null;
}): Promise<{ run: GameRun; state: GameState }> => {
  const snapshot = await client.startGame();
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
  const id = await gameRunRepository.createOne({ db, gameRun });

  return { run: { ...gameRun, id }, state };
};

import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import { gameRunRepository } from '../../repositories/index.ts';

export const finishRun = async ({
  db,
  run,
  state,
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
}): Promise<void> => {
  await gameRunRepository.updateOne({
    db,
    id: run.id,
    patch: {
      lives: state.lives,
      gold: state.gold,
      dragonLevel: state.dragonLevel,
      turn: state.turn,
      score: state.score,
      status: 'game_over',
      endedAt: new Date(),
    },
  });
};

import type { GameState } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { GameRun, RunStatus } from '../../entities/game-run.ts';
import { gameRunRepository } from '../../repositories/index.ts';
import { statePatch } from './state-patch.ts';

export const finishRun = async ({
  db,
  run,
  state,
  status = 'game_over',
}: {
  db: Knex;
  run: GameRun;
  state: GameState;
  status?: Exclude<RunStatus, 'active'>;
}): Promise<void> => {
  await gameRunRepository.db.updateOne({
    db,
    id: run.id,
    patch: { ...statePatch({ state }), status, endedAt: new Date() },
  });
};

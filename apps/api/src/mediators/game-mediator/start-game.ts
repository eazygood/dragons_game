import type { GameView } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { startGameRun } from '../../managers/game-manager/index.ts';
import { toGameView } from './game-view.ts';

export const startGame = async ({ db }: { db: Knex }): Promise<GameView> => {
  const { run } = await startGameRun({ db, strategy: 'manual' });

  return toGameView({ run });
};

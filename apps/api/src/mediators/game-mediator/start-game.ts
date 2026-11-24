import type { GameView } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { startGame as startRun } from '../../managers/game-manager/index.ts';
import { toGameView } from './game-view.ts';

export const startGame = async ({ db }: { db: Knex }): Promise<GameView> => {
  const { run } = await startRun({ db, strategy: 'manual' });

  return toGameView({ run });
};

import type { GameView } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { findRun } from '../../managers/game-manager/index.ts';
import { toGameView } from '../shared/game-view.ts';

// Reads only the database, so a finished game still answers 200 with its final state.
export const findGame = async ({ db, gameId }: { db: Knex; gameId: string }): Promise<GameView> =>
  toGameView({ run: await findRun({ db, gameId }) });

import type { Move } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { findMoves as findRunMoves } from '../../managers/game-manager/index.ts';

export const findMoves = ({ db, gameId }: { db: Knex; gameId: string }): Promise<Move[]> =>
  findRunMoves({ db, gameId });

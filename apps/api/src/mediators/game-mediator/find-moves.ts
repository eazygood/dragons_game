import type { Move } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import { findMoveHistory } from '../../managers/game-manager/index.ts';

export const findMoves = ({ db, gameId }: { db: Knex; gameId: string }): Promise<Move[]> =>
  findMoveHistory({ db, gameId });

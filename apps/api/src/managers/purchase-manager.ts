import type { Knex } from 'knex';

import type { GameRunId } from '../entities/game-run.ts';
import type { Purchase } from '../entities/purchase.ts';
import * as purchaseRepository from '../repositories/purchase-repository.ts';

// The one way other managers reach purchases, so the table has a single owner even
// while every call only passes through.
export const createOne = ({ db, purchase }: { db: Knex; purchase: Purchase }): Promise<void> =>
  purchaseRepository.createOne({ db, purchase });

export const findMany = ({
  db,
  gameRunId,
}: {
  db: Knex;
  gameRunId: GameRunId;
}): Promise<Purchase[]> => purchaseRepository.findMany({ db, gameRunId });

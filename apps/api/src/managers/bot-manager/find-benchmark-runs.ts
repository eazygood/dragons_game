import type { Knex } from 'knex';

import type { GameRun } from '../../entities/game-run.ts';
import { gameRunRepository } from '../../repositories/index.ts';

export const findBenchmarkRuns = ({
  db,
  benchmarkId,
}: {
  db: Knex;
  benchmarkId: string;
}): Promise<GameRun[]> => gameRunRepository.db.findMany({ db, benchmarkId });

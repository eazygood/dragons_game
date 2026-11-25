import type { Knex } from 'knex';

import type { Logger } from '../../entities/logger.ts';
import { databaseRepository } from '../../repositories/index.ts';

export type HealthStatus = { status: 'ok' | 'unavailable' };

// A failed probe is the answer this check exists to give, so it is reported, not rethrown.
export const checkDatabase = async ({
  db,
  logger,
}: {
  db: Knex;
  logger: Logger;
}): Promise<HealthStatus> => {
  try {
    await databaseRepository.db.ping({ db });

    return { status: 'ok' };
  } catch (error) {
    logger.warn({ err: error }, 'database health check failed');

    return { status: 'unavailable' };
  }
};

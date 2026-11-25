import type { Knex } from 'knex';

import type { Logger } from '../../entities/logger.ts';
import { checkDatabase } from '../../managers/health-manager/index.ts';
import type { HealthStatus } from '../../managers/health-manager/index.ts';

export const findHealth = ({ db, logger }: { db: Knex; logger: Logger }): Promise<HealthStatus> =>
  checkDatabase({ db, logger });

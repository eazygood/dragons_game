import type { Knex } from 'knex';

import { STRATEGY_CONFIG } from '../../domain/engine/strategy-config.ts';
import type { Logger } from '../../entities/logger.ts';
import { loadCalibration } from './load-calibration.ts';

// A human's game has no benchmark scope, so it reads all history and, unlike a bot, reads it
// again on every request: each of its moves is a separate request with no state in memory.
export const loadPlayerCalibration = ({ db, logger }: { db: Knex; logger: Logger }) =>
  loadCalibration({
    db,
    strategy: 'calibrated',
    config: STRATEGY_CONFIG,
    logger,
    benchmarkId: null,
  });

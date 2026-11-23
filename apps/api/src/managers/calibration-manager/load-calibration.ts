import type { StrategyName } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../../config/logger.ts';
import { buildCalibration, priorCalibration } from '../../domain/engine/calibration.ts';
import type { Calibration } from '../../domain/engine/calibration.ts';
import type { StrategyConfig } from '../../domain/engine/strategy-config.ts';
import { adAttemptRepository } from '../../repositories/index.ts';

// A null scope reads all history; a benchmark id reads only that benchmark's games.
export const loadCalibration = async ({
  db,
  strategy,
  config,
  logger,
  benchmarkId,
}: {
  db: Knex;
  strategy: StrategyName;
  config: StrategyConfig;
  logger: Logger;
  benchmarkId: string | null;
}): Promise<Calibration> => {
  if (strategy === 'baseline') {
    return priorCalibration({ config });
  }

  try {
    const counts = await adAttemptRepository.db.findCalibrationCounts({ db, benchmarkId });

    return buildCalibration({ counts, config });
  } catch (error) {
    logger.warn({ err: error }, 'calibration read failed; playing on the prior');
    return priorCalibration({ config });
  }
};

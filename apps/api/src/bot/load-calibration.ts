import type { Knex } from 'knex';

import { buildCalibration, priorCalibration } from '../domain/engine/calibration.ts';
import type { Calibration } from '../domain/engine/calibration.ts';
import type { StrategyConfig } from '../domain/engine/strategy-config.ts';
import { adAttemptRepository } from '../repositories/index.ts';
import type { BotLogger, BotStrategy } from './types.ts';

// Loaded once per run: within-run drift is small, and a per-turn read would sit
// on the critical path of a rate-limited loop.
export const loadCalibration = async ({
  db,
  strategy,
  config,
  logger,
}: {
  db: Knex;
  strategy: BotStrategy;
  config: StrategyConfig;
  logger: BotLogger;
}): Promise<Calibration> => {
  if (strategy === 'baseline') {
    return priorCalibration({ config });
  }

  try {
    const counts = await adAttemptRepository.findCalibrationCounts({ db });

    return buildCalibration({ counts, config });
  } catch (error) {
    logger.warn({ err: error }, 'calibration read failed; playing on the prior');
    return priorCalibration({ config });
  }
};

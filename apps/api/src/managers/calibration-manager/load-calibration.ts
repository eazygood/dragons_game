import type { Knex } from 'knex';

import { buildCalibration, priorCalibration } from '../../domain/engine/calibration.ts';
import type { MeasuredCalibration } from '../../domain/engine/calibration.ts';
import type { StrategyConfig } from '../../domain/engine/strategy-config.ts';
import type { BotStrategy } from '../../entities/bot-run.ts';
import type { Logger } from '../../entities/logger.ts';
import { adAttemptRepository } from '../../repositories/index.ts';

type LoadCalibrationInput = {
  db: Knex;
  strategy: BotStrategy;
  config: StrategyConfig;
  logger: Logger;
  benchmarkId: string | null;
  /** Played on when the read fails; the prior unless the caller already holds one. */
  fallback?: MeasuredCalibration;
};

const readCalibration = async ({
  db,
  config,
  logger,
  benchmarkId,
  fallback,
}: Omit<LoadCalibrationInput, 'strategy' | 'fallback'> & {
  fallback: MeasuredCalibration;
}): Promise<MeasuredCalibration> => {
  try {
    const counts = await adAttemptRepository.db.findCalibrationCounts({ db, benchmarkId });

    return buildCalibration({ counts, config });
  } catch (error) {
    logger.warn({ err: error }, 'calibration read failed; playing on the last one');
    return fallback;
  }
};

// A null scope reads all history; a benchmark id reads only that benchmark's games.
export const loadCalibration = ({
  db,
  strategy,
  config,
  logger,
  benchmarkId,
  fallback = priorCalibration({ config }),
}: LoadCalibrationInput): Promise<MeasuredCalibration> => {
  switch (strategy) {
    case 'baseline':
      return Promise.resolve(priorCalibration({ config }));
    case 'calibrated':
      return readCalibration({ db, config, logger, benchmarkId, fallback });
    default: {
      const unhandled: never = strategy;

      throw new Error(`No calibration for strategy ${String(unhandled)}`);
    }
  }
};

import type { Knex } from 'knex';

import { buildCalibration, priorCalibration, withAttempt } from '../engine/calibration.ts';
import type { CalibrationAttempt, MeasuredCalibration } from '../engine/calibration.ts';
import { STRATEGY_CONFIG } from '../engine/strategy-config.ts';
import type { StrategyConfig } from '../engine/strategy-config.ts';
import type { BotStrategy } from '../entities/game-run.ts';
import type { Logger } from '../types.ts';
import * as adAttemptManager from './ad-attempt-manager.ts';

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
    const counts = await adAttemptManager.findCalibrationCounts({ db, benchmarkId });

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

// The baseline is defined as playing without evidence, so only the calibrated strategy learns.
export const learnFromAttempt = ({
  strategy,
  calibration,
  attempt,
}: {
  strategy: BotStrategy;
  calibration: MeasuredCalibration;
  attempt: CalibrationAttempt;
}): MeasuredCalibration => {
  switch (strategy) {
    case 'baseline':
      return calibration;
    case 'calibrated':
      return withAttempt({ calibration, attempt });
    default: {
      const unhandled: never = strategy;

      throw new Error(`No calibration for strategy ${String(unhandled)}`);
    }
  }
};

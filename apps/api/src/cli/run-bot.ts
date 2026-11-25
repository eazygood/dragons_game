import type { Knex } from 'knex';

import type { StrategyConfig } from '../domain/engine/strategy-config.ts';
import type { Logger } from '../entities/logger.ts';
import { SILENT_LOGGER, playGame } from '../managers/bot-manager/index.ts';
import { startGameRun } from '../managers/game-manager/index.ts';
import type { BotRunResult, BotStrategy } from './types.ts';

export const runBot = async ({
  db,
  strategy,
  benchmarkId = null,
  calibrationBenchmarkId = null,
  config,
  logger = SILENT_LOGGER,
  maxTurns,
}: {
  db: Knex;
  strategy: BotStrategy;
  benchmarkId?: string | null;
  /** Restricts calibration to one benchmark's games; null reads all history. */
  calibrationBenchmarkId?: string | null;
  config?: StrategyConfig;
  logger?: Logger;
  maxTurns?: number;
}): Promise<BotRunResult> => {
  const { run, state } = await startGameRun({ db, strategy, benchmarkId });

  return playGame({ db, run, state, strategy, calibrationBenchmarkId, config, logger, maxTurns });
};

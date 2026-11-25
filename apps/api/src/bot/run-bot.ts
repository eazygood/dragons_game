import type { Knex } from 'knex';

import type { StrategyConfig } from '../domain/engine/strategy-config.ts';
import { SILENT_LOGGER, playGame } from '../managers/bot-manager/index.ts';
import { startGame } from '../managers/game-manager/index.ts';
import type { BotLogger, BotRunResult, BotStrategy } from './types.ts';

export { DEFAULT_MAX_TURNS, SILENT_LOGGER } from '../managers/bot-manager/index.ts';

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
  logger?: BotLogger;
  maxTurns?: number;
}): Promise<BotRunResult> => {
  const { run, state } = await startGame({ db, strategy, benchmarkId });

  return playGame({ db, run, state, strategy, calibrationBenchmarkId, config, logger, maxTurns });
};

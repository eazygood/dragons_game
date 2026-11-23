import { randomUUID } from 'node:crypto';

import type { Knex } from 'knex';

import type { MugloarClient } from '../adapters/mugloar-api-adapter/index.ts';
import { STRATEGY_CONFIG } from '../domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../domain/engine/strategy-config.ts';
import { BENCHMARK_TARGET, summarise } from './benchmark-report.ts';
import type { BenchmarkSummary } from './benchmark-report.ts';
import { runBounded } from './bounded-pool.ts';
import { runBot, SILENT_LOGGER } from './run-bot.ts';
import type { BotLogger, BotStrategy } from './types.ts';

export const DEFAULT_CONCURRENCY = 3;

export const runBenchmark = async ({
  db,
  client,
  strategy,
  runs,
  warm = false,
  concurrency = DEFAULT_CONCURRENCY,
  config = STRATEGY_CONFIG,
  logger = SILENT_LOGGER,
}: {
  db: Knex;
  client: MugloarClient;
  strategy: BotStrategy;
  runs: number;
  warm?: boolean;
  concurrency?: number;
  config?: StrategyConfig;
  logger?: BotLogger;
}): Promise<BenchmarkSummary> => {
  const benchmarkId = randomUUID();
  // Twenty games of per-decision lines would bury the result; warnings still surface.
  const botLogger: BotLogger = {
    info: () => undefined,
    warn: (details, message) => logger.warn(details, message),
  };

  // Cold reads only this benchmark's own games, so other history is never deleted.
  const calibrationBenchmarkId = warm ? null : benchmarkId;

  const results = await runBounded({
    count: runs,
    concurrency,
    task: async (index) => {
      const result = await runBot({
        db,
        client,
        strategy,
        benchmarkId,
        calibrationBenchmarkId,
        config,
        logger: botLogger,
      });

      logger.info({ benchmarkId, run: index + 1, ...result }, 'benchmark run finished');

      return result;
    },
  });

  return { ...summarise({ results, target: BENCHMARK_TARGET }), benchmarkId, strategy };
};

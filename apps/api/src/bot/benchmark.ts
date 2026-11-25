import { randomUUID } from 'node:crypto';

import { TARGET_SCORE } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import { STRATEGY_CONFIG } from '../domain/engine/strategy-config.ts';
import type { StrategyConfig } from '../domain/engine/strategy-config.ts';
import { summarise } from './benchmark-report.ts';
import type { BenchmarkSummary } from './benchmark-report.ts';
import { runBounded } from './bounded-pool.ts';
import { runBot, SILENT_LOGGER } from './run-bot.ts';
import type { BotLogger, BotStrategy } from './types.ts';

export const DEFAULT_CONCURRENCY = 3;

export const runBenchmark = async ({
  db,
  strategy,
  runs,
  readsAllHistory = false,
  concurrency = DEFAULT_CONCURRENCY,
  config = STRATEGY_CONFIG,
  logger = SILENT_LOGGER,
}: {
  db: Knex;
  strategy: BotStrategy;
  runs: number;
  readsAllHistory?: boolean;
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
  const calibrationBenchmarkId = readsAllHistory ? null : benchmarkId;

  const results = await runBounded({
    count: runs,
    concurrency,
    task: async (index) => {
      const result = await runBot({
        db,
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

  return { ...summarise({ results, target: TARGET_SCORE }), benchmarkId, strategy };
};

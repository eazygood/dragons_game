import { randomUUID } from 'node:crypto';

import { TARGET_SCORE } from '@bigbank-dragon/contracts';
import type { Knex } from 'knex';

import type { Logger } from '../entities/logger.ts';
import {
  STRATEGY_CONFIG,
  SILENT_LOGGER,
  findBenchmarkRuns,
} from '../managers/bot-manager/index.ts';
import type { StrategyConfig } from '../managers/bot-manager/index.ts';
import { summarise } from './benchmark-report.ts';
import type { BenchmarkSummary } from './benchmark-report.ts';
import { runBounded } from './bounded-pool.ts';
import { runBot } from './run-bot.ts';
import type { BotStrategy } from './types.ts';

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
  logger?: Logger;
}): Promise<BenchmarkSummary> => {
  const benchmarkId = randomUUID();
  // Twenty games of per-decision lines would bury the result; warnings still surface.
  const botLogger: Logger = {
    info: () => undefined,
    warn: (details, message) => logger.warn(details, message),
    error: (details, message) => logger.error(details, message),
  };

  // Cold reads only this benchmark's own games, so other history is never deleted.
  const calibrationBenchmarkId = readsAllHistory ? null : benchmarkId;

  const outcomes = await runBounded({
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

  const results = outcomes.flatMap((outcome) =>
    outcome.status === 'fulfilled' ? [outcome.value] : [],
  );

  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'rejected') {
      const failure: unknown = outcome.reason;

      logger.warn({ err: failure, benchmarkId, run: index + 1 }, 'benchmark run failed');
    }
  });

  const runDurationsInMs = (await findBenchmarkRuns({ db, benchmarkId })).flatMap(
    ({ startedAt, endedAt }) => (endedAt === null ? [] : [endedAt.getTime() - startedAt.getTime()]),
  );

  return {
    ...summarise({
      results,
      failedRuns: outcomes.length - results.length,
      runDurationsInMs,
      target: TARGET_SCORE,
    }),
    benchmarkId,
    strategy,
  };
};

import { randomUUID } from 'node:crypto';

import { ProbabilityLabelSchema, TARGET_SCORE } from '@dragons-game/contracts';
import type { Knex } from 'knex';
import { z } from 'zod';

import type { Logger } from '../types.ts';
import { STRATEGY_CONFIG, SILENT_LOGGER, playNewGame } from '../managers/bot-manager.ts';
import type { BotStrategy, StrategyConfig } from '../managers/bot-manager.ts';
import * as gameManager from '../managers/game-manager/index.ts';
import { summarise } from './benchmark-report.ts';
import type { BenchmarkSummary } from './benchmark-report.ts';

export const DEFAULT_CONCURRENCY = 3;

// Strict, so a typo in a sweep fails loudly rather than measuring the defaults.
const StrategyOverrideSchema = z
  .object({
    smoothingAlpha: z.number().positive(),
    probabilityPrior: z.record(ProbabilityLabelSchema, z.number().min(0).max(1)),
    levelBucketEdges: z.array(z.number().int().nonnegative()),
    rewardBandEdges: z.array(z.number().nonnegative()),
    livesFloor: z.number().int().nonnegative(),
    minimumProbability: z.number().min(0).max(1),
    lifeCostInGold: z.number().nonnegative(),
    turnCostInGold: z.number().nonnegative(),
    levelUpFromScore: z.number().int().nonnegative().nullable(),
    levelUpGoldReserve: z.number().nonnegative(),
  } satisfies Record<keyof StrategyConfig, z.ZodType>)
  .partial()
  .strict();

export const applyStrategyOverride = ({ json }: { json: string | undefined }): StrategyConfig => {
  if (json === undefined) {
    return STRATEGY_CONFIG;
  }

  return { ...STRATEGY_CONFIG, ...StrategyOverrideSchema.parse(JSON.parse(json)) };
};

// Runs `count` tasks with at most `concurrency` in flight; outcomes keep index order.
// A failed task never stops the rest: a benchmark reports a lost run, it does not
// throw away the other nineteen.
export const runBounded = async <T>({
  count,
  concurrency,
  task,
}: {
  count: number;
  concurrency: number;
  task: (index: number) => Promise<T>;
}): Promise<PromiseSettledResult<T>[]> => {
  const outcomes: PromiseSettledResult<T>[] = [];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < count) {
      const index = nextIndex;

      nextIndex += 1;

      try {
        outcomes[index] = { status: 'fulfilled', value: await task(index) };
      } catch (reason) {
        outcomes[index] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));

  return outcomes;
};

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
      const result = await playNewGame({
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

  const runDurationsInMs = (await gameManager.findBenchmarkRuns({ db, benchmarkId })).flatMap(
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

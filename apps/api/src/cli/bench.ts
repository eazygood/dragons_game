import { parseArgs } from 'node:util';

import { z } from 'zod';

import { DEFAULT_CONCURRENCY, runBenchmark } from './benchmark.ts';
import { formatSummary } from './benchmark-report.ts';
import { consoleLogger, createLiveRuntime } from './live-runtime.ts';
import { applyStrategyOverride } from './strategy-override.ts';
import { BotStrategySchema } from './types.ts';

const DEFAULT_RUNS = 20;

const BenchArgsSchema = z.object({
  runs: z.coerce.number().int().positive(),
  strategy: BotStrategySchema,
  warm: z.boolean(),
  concurrency: z.coerce.number().int().positive(),
  override: z.string().optional(),
});

const main = async () => {
  const { values } = parseArgs({
    options: {
      runs: { type: 'string', default: String(DEFAULT_RUNS) },
      strategy: { type: 'string', default: 'calibrated' },
      warm: { type: 'boolean', default: false },
      concurrency: { type: 'string', default: String(DEFAULT_CONCURRENCY) },
      override: { type: 'string' },
    },
  });
  const { warm, ...args } = BenchArgsSchema.parse(values);
  const config = applyStrategyOverride({ json: args.override });
  const { db } = createLiveRuntime();

  try {
    const summary = await runBenchmark({
      db,
      ...args,
      readsAllHistory: warm,
      config,
      logger: consoleLogger,
    });

    console.log(formatSummary({ summary }));
    console.log(`  config ${JSON.stringify(config)}`);
  } finally {
    await db.destroy();
  }
};

await main();

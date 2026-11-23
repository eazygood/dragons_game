import { parseArgs } from 'node:util';

import { z } from 'zod';

import { DEFAULT_CONCURRENCY, runBenchmark } from '../bot/benchmark.ts';
import { formatSummary } from '../bot/benchmark-report.ts';
import { applyStrategyOverride } from '../bot/strategy-override.ts';
import { consoleLogger, createLiveRuntime } from './live-runtime.ts';

const DEFAULT_RUNS = 20;

const BenchArgsSchema = z.object({
  runs: z.coerce.number().int().positive(),
  strategy: z.enum(['baseline', 'calibrated']),
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
  const args = BenchArgsSchema.parse(values);
  const config = applyStrategyOverride({ json: args.override });
  const { db } = createLiveRuntime();

  try {
    const summary = await runBenchmark({ db, ...args, config, logger: consoleLogger });

    console.log(formatSummary({ summary }));
    console.log(`  config ${JSON.stringify(config)}`);
  } finally {
    await db.destroy();
  }
};

await main();

import { parseArgs } from 'node:util';

import { z } from 'zod';

import { runBot } from '../bot/run-bot.ts';
import { consoleLogger, createLiveRuntime } from './live-runtime.ts';

const BotStrategySchema = z.enum(['baseline', 'calibrated']);

const main = async () => {
  const { values } = parseArgs({
    options: { strategy: { type: 'string', default: 'calibrated' } },
  });
  const strategy = BotStrategySchema.parse(values.strategy);
  const { db } = createLiveRuntime();

  try {
    const result = await runBot({ db, strategy, logger: consoleLogger });

    console.log(
      `Game ${result.gameId}: score ${result.score} in ${result.turns} turns (${strategy})`,
    );
  } finally {
    await db.destroy();
  }
};

await main();

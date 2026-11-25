import { parseArgs } from 'node:util';

import { consoleLogger, createLiveRuntime } from './live-runtime.ts';
import { runBot } from './run-bot.ts';
import { BotStrategySchema } from './types.ts';

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

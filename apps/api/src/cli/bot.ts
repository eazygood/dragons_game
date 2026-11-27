import { parseArgs } from 'node:util';

import { consoleLogger, createLiveRuntime } from './live-runtime.ts';
import { BotStrategySchema, DEFAULT_BOT_STRATEGY } from '../entities/game-run.ts';
import { playNewGame } from '../managers/bot-manager.ts';

const main = async () => {
  const { values } = parseArgs({
    options: { strategy: { type: 'string', default: DEFAULT_BOT_STRATEGY } },
  });
  const strategy = BotStrategySchema.parse(values.strategy);
  const { db } = createLiveRuntime();

  try {
    const result = await playNewGame({ db, strategy, logger: consoleLogger });

    console.log(
      `Game ${result.gameId}: score ${result.score} in ${result.turns} turns (${strategy})`,
    );
  } finally {
    await db.destroy();
  }
};

await main();

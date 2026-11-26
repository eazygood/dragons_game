import fp from 'fastify-plugin';

import { createBotGameRegistry } from '../mediators/bot-mediator.ts';
import type { BotGameRegistry } from '../mediators/bot-mediator.ts';

declare module 'fastify' {
  interface FastifyInstance {
    botGames: BotGameRegistry;
  }
}

// Registered after the mysql plugin: onClose hooks run last-registered first, so the games
// have finished their final writes before the pool is destroyed.
export const botGamesPlugin = fp<{ limit: number }>((app, { limit }) => {
  const registry = createBotGameRegistry({ limit });

  app.decorate('botGames', registry);
  app.addHook('onClose', () => registry.shutdown());

  return Promise.resolve();
});

import type { FastifyInstance } from 'fastify';

import type { AppLimits } from '../app-limits.ts';
import { botMediator } from '../mediators/index.ts';
import { rateLimitConfig } from './rate-limit-config.ts';

const HTTP_CREATED = 201;

export const registerBotRoutes = (app: FastifyInstance, { limits }: { limits: AppLimits }) => {
  app.post(
    '/bot-games',
    { config: rateLimitConfig({ rate: limits.startGameRate }) },
    // app.log, not request.log: the game keeps logging after this request has ended.
    async (_request, reply) =>
      reply
        .status(HTTP_CREATED)
        .send(
          await botMediator.startBotGame({ db: app.db, logger: app.log, registry: app.botGames }),
        ),
  );
};

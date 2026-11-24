import type { FastifyInstance } from 'fastify';

import { botMediator } from '../mediators/index.ts';

const HTTP_CREATED = 201;

export const registerBotRoutes = (app: FastifyInstance) => {
  // app.log, not request.log: the game keeps logging after this request has ended.
  app.post('/bot-games', async (_request, reply) =>
    reply
      .status(HTTP_CREATED)
      .send(await botMediator.startBotGame({ db: app.db, logger: app.log })),
  );
};

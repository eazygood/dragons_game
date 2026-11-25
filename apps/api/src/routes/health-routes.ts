import type { FastifyInstance } from 'fastify';

import { healthMediator } from '../mediators/index.ts';

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

export const registerHealthRoutes = (app: FastifyInstance) => {
  app.get('/health', async (request, reply) => {
    const health = await healthMediator.findHealth({ db: app.db, logger: request.log });

    return reply.status(health.status === 'ok' ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE).send(health);
  });
};

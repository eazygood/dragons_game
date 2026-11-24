import type { FastifyInstance } from 'fastify';

import { registerHealthRoutes } from './health-routes.ts';

export const registerRoutes = (app: FastifyInstance) => {
  registerHealthRoutes(app);

  return Promise.resolve();
};

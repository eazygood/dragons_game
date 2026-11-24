import type { FastifyInstance } from 'fastify';

import { registerGameRoutes } from './game-routes.ts';
import { registerHealthRoutes } from './health-routes.ts';

export const registerRoutes = (app: FastifyInstance) => {
  registerHealthRoutes(app);
  registerGameRoutes(app);

  return Promise.resolve();
};

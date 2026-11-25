import type { FastifyInstance } from 'fastify';

import { registerBotRoutes } from './bot-routes.ts';
import { registerGameRoutes } from './game-routes.ts';
import { registerHealthRoutes } from './health-routes.ts';

export const registerRoutes = (app: FastifyInstance) => {
  registerHealthRoutes(app);
  registerGameRoutes(app);
  registerBotRoutes(app);

  return Promise.resolve();
};

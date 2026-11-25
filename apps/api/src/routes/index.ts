import type { FastifyInstance } from 'fastify';

import type { AppLimits } from '../app-limits.ts';
import { registerBotRoutes } from './bot-routes.ts';
import { registerGameRoutes } from './game-routes.ts';
import { registerHealthRoutes } from './health-routes.ts';

export const registerRoutes = (app: FastifyInstance, { limits }: { limits: AppLimits }) => {
  registerHealthRoutes(app);
  registerGameRoutes(app, { limits });
  registerBotRoutes(app, { limits });

  return Promise.resolve();
};

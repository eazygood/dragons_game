import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { AppConfig } from './config/index.ts';
import { mysqlPlugin, zodValidatorCompiler } from './plugins/index.ts';
import { errorHandler, notFoundHandler } from './routes/error-handlers/error-handler.ts';
import { registerRoutes } from './routes/index.ts';

export const buildApp = async ({
  config,
  logger,
}: {
  config: AppConfig;
  logger: FastifyServerOptions['logger'];
}): Promise<FastifyInstance> => {
  const app = Fastify({ logger });

  await app.register(mysqlPlugin, { config });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  await app.register(registerRoutes, { prefix: '/api' });

  return app;
};

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import type { AppConfig } from './config/index.ts';
import { mysqlPlugin, webAppPlugin, zodValidatorCompiler } from './plugins/index.ts';
import { API_PREFIX } from './routes/api-prefix.ts';
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
  await app.register(registerRoutes, { prefix: API_PREFIX });
  await app.register(webAppPlugin, { config });

  return app;
};

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import { configureMugloarApi } from './adapters/mugloar-api-adapter/index.ts';
import { DEFAULT_APP_LIMITS, type AppLimits } from './app-limits.ts';
import type { AppConfig } from './config/index.ts';
import {
  botGamesPlugin,
  jsonOnlyBodiesPlugin,
  mysqlPlugin,
  notFoundHandler,
  rateLimitPlugin,
  securityHeadersPlugin,
  webAppPlugin,
  zodValidatorCompiler,
} from './plugins/index.ts';
import { API_PREFIX } from './routes/api-prefix.ts';
import { errorHandler } from './routes/error-handlers/error-handler.ts';
import { registerRoutes } from './routes/index.ts';

export const buildApp = async ({
  config,
  logger,
  limits = DEFAULT_APP_LIMITS,
}: {
  config: AppConfig;
  logger: FastifyServerOptions['logger'];
  limits?: AppLimits;
}): Promise<FastifyInstance> => {
  configureMugloarApi({ config });

  const app = Fastify({ logger, requestTimeout: limits.requestTimeoutMs });

  await app.register(mysqlPlugin, { config });
  await app.register(botGamesPlugin, { limit: limits.maxBotGames });
  await app.register(securityHeadersPlugin);
  await app.register(rateLimitPlugin);
  await app.register(jsonOnlyBodiesPlugin);
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  await app.register(registerRoutes, { prefix: API_PREFIX, limits });
  await app.register(webAppPlugin, { config });

  return app;
};

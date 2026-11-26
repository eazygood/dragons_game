import { relative, resolve, sep } from 'node:path';

import type { ApiErrorBody } from '@dragons-game/contracts';
import fastifyStatic from '@fastify/static';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { API_PREFIX } from '../api-prefix.ts';
import type { AppConfig } from '../config/index.ts';

const HTTP_NOT_FOUND = 404;
const WEB_APP_ENTRY = 'index.html';
const API_PATH_PATTERN = new RegExp(`^${API_PREFIX}(?:[/?]|$)`);
const HASHED_ASSETS_DIR = 'assets';
// Vite names everything under assets/ by content hash, so a cached copy can never be stale.
const HASHED_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const REVALIDATE_CACHE_CONTROL = 'no-cache';
const ROUTE_NOT_FOUND: ApiErrorBody = { error: { code: 'not_found', message: 'Route not found' } };

// fastify-plugin lifts sendFile onto the root instance, where the not-found handler uses it.
export const webAppPlugin = fp<{ config: AppConfig }>(async (app, { config }) => {
  if (config.webDistDir === null) {
    return;
  }

  const root = resolve(config.webDistDir);

  await app.register(fastifyStatic, {
    root,
    // A dotfile in the build output (.env, .git) is never part of the app, even if it is there.
    dotfiles: 'deny',
    setHeaders: (reply, filePath) => {
      const [topDirectory] = relative(root, filePath).split(sep);

      reply.header(
        'cache-control',
        topDirectory === HASHED_ASSETS_DIR ? HASHED_ASSET_CACHE_CONTROL : REVALIDATE_CACHE_CONTROL,
      );
    },
  });
});

// reply.sendFile exists only once @fastify/static is registered, so it tells us a web app is served.
const isWebAppRoute = ({ request }: { request: FastifyRequest }) =>
  request.method === 'GET' &&
  !API_PATH_PATTERN.test(request.url) &&
  request.server.hasReplyDecorator('sendFile');

export const notFoundHandler = (request: FastifyRequest, reply: FastifyReply) => {
  if (isWebAppRoute({ request })) {
    return reply.sendFile(WEB_APP_ENTRY);
  }

  return reply.status(HTTP_NOT_FOUND).send(ROUTE_NOT_FOUND);
};

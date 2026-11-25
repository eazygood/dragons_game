import { resolve } from 'node:path';

import fastifyStatic from '@fastify/static';
import fp from 'fastify-plugin';

import type { AppConfig } from '../config/index.ts';

// fastify-plugin lifts sendFile onto the root instance, where the not-found handler uses it.
export const webAppPlugin = fp<{ config: AppConfig }>(async (app, { config }) => {
  if (config.webDistDir === null) {
    return;
  }

  await app.register(fastifyStatic, { root: resolve(config.webDistDir) });
});

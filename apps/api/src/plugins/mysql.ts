import fp from 'fastify-plugin';
import type { Knex } from 'knex';

import { createDatabase } from '../adapters/mysql-adapter.ts';
import type { AppConfig } from '../config/index.ts';

declare module 'fastify' {
  interface FastifyInstance {
    db: Knex;
  }
}

// fastify-plugin lifts the decorator out of this plugin's scope, so every route sees app.db.
export const mysqlPlugin = fp<{ config: AppConfig }>((app, { config }) => {
  const db = createDatabase({ config });

  app.decorate('db', db);
  app.addHook('onClose', () => db.destroy());

  return Promise.resolve();
});

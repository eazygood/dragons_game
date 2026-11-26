import type { Knex } from 'knex';
import { afterAll, beforeAll, beforeEach } from 'vitest';

import { createDatabase } from '../../src/adapters/mysql-adapter.ts';
import { loadConfig } from '../../src/config/index.ts';
import { DbTables } from '../../src/repositories/db-tables.ts';

// Builds the schema from scratch, so a suite never inherits a migration state or rows.
export const migrateFresh = async ({ db }: { db: Knex }): Promise<void> => {
  await db.migrate.rollback(undefined, true);
  await db.migrate.latest();
};

// Attempts and purchases go with their runs, through the foreign keys' cascade.
export const emptyRuns = async ({ db }: { db: Knex }): Promise<void> => {
  await db(DbTables.GameRuns).delete();
};

// The pool connects on first use, so the handle exists while the suite is being collected and
// tests can use it directly; the hooks migrate it before the first test and close it after.
export const useMigratedDatabase = (): Knex => {
  const db = createDatabase({ config: loadConfig({ env: process.env }) });

  beforeAll(() => migrateFresh({ db }));
  beforeEach(() => emptyRuns({ db }));
  afterAll(() => db.destroy());

  return db;
};

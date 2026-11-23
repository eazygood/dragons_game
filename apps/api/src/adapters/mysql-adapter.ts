import { fileURLToPath } from 'node:url';

import knex from 'knex';
import type { Knex } from 'knex';

import type { AppConfig } from '../config/index.ts';

export type DbExecutor = Knex | Knex.Transaction;

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../../migrations/', import.meta.url));

export const databaseConfig = ({ config }: { config: AppConfig }): Knex.Config => ({
  client: 'mysql2',
  // Store and read every datetime as UTC, and DECIMAL columns as numbers.
  connection: { uri: config.databaseUrl, timezone: 'Z', decimalNumbers: true },
  migrations: { directory: MIGRATIONS_DIRECTORY, extension: 'ts', loadExtensions: ['.ts'] },
});

export const createDatabase = ({ config }: { config: AppConfig }): Knex =>
  knex(databaseConfig({ config }));

// The only place a transaction is opened. Managers own transactions;
// repositories receive the executor and never open one themselves.
export const withTransaction = <T>({
  db,
  callback,
}: {
  db: Knex;
  callback: (trx: Knex.Transaction) => Promise<T>;
}): Promise<T> => db.transaction(callback);

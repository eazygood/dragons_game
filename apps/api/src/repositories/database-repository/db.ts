import type { DbExecutor } from '../../adapters/mysql-adapter.ts';

// A liveness probe rather than an entity read, so it is not named after a CRUD verb.
const ping = async ({ db }: { db: DbExecutor }) => {
  await db.raw('select 1');
};

export const dbRepository = { ping };

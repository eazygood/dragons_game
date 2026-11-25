import { createDatabase } from './adapters/mysql-adapter.ts';
import { loadConfig } from './config/index.ts';

const db = createDatabase({ config: loadConfig({ env: process.env }) });

try {
  // knex types the result as any; it is [batch number, applied file names].
  const [batch, applied] = (await db.migrate.latest()) as [number, string[]];

  console.log(`Batch ${batch}: ${applied.length} migration(s) applied`);
} finally {
  await db.destroy();
}

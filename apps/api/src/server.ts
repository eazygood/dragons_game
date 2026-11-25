import { buildApp } from './app.ts';
import { loadConfig } from './config/index.ts';

const config = loadConfig({ env: process.env });
const app = await buildApp({ config, logger: { level: config.logLevel } });

// Closing stops the bot games and waits for them before the pool goes. Once, so a second
// signal falls through to Node's default and ends a shutdown that is taking too long.
const shutdown = () => {
  app.close().catch((error: unknown) => {
    app.log.error({ err: error }, 'shutdown failed');
    process.exitCode = 1;
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

await app.listen({ host: config.apiHost, port: config.apiPort });

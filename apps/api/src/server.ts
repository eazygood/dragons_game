import { buildApp } from './app.ts';
import { loadConfig } from './config/index.ts';

const config = loadConfig({ env: process.env });
const app = await buildApp({ config, logger: { level: config.logLevel } });

const shutdown = () => {
  void app.close();
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

await app.listen({ host: config.apiHost, port: config.apiPort });

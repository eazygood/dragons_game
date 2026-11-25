import { configureMugloarApi } from '../adapters/mugloar-api-adapter/index.ts';
import { createDatabase } from '../adapters/mysql-adapter.ts';
import { loadConfig } from '../config/index.ts';
import type { Logger } from '../entities/logger.ts';

// What every CLI that plays the live game needs: one config for the database and the upstream.
export const createLiveRuntime = () => {
  const config = loadConfig({ env: process.env });
  const db = createDatabase({ config });

  configureMugloarApi({ config });

  return { config, db };
};

export const consoleLogger: Logger = {
  info: (details, message) => console.log(message, JSON.stringify(details)),
  warn: (details, message) => console.warn(message, details),
  error: (details, message) => console.error(message, details),
};

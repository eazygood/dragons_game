import { createDatabase } from '../adapters/mysql-adapter.ts';
import type { BotLogger } from '../bot/types.ts';
import { loadConfig } from '../config/index.ts';

// What every CLI that plays the live game needs; the upstream adapter reads its own config.
export const createLiveRuntime = () => {
  const config = loadConfig({ env: process.env });
  const db = createDatabase({ config });

  return { config, db };
};

export const consoleLogger: BotLogger = {
  info: (details, message) => console.log(message, JSON.stringify(details)),
  warn: (details, message) => console.warn(message, details),
};

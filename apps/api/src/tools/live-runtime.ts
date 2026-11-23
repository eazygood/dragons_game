import { setTimeout as sleep } from 'node:timers/promises';

import { createMugloarClient } from '../adapters/mugloar-api-adapter/index.ts';
import { createTokenBucket } from '../adapters/mugloar-api-adapter/throttle.ts';
import { createDatabase } from '../adapters/mysql-adapter.ts';
import type { BotLogger } from '../bot/types.ts';
import { loadConfig } from '../config/index.ts';

// What every CLI that plays the live game needs: one throttle, one client, one pool.
export const createLiveRuntime = () => {
  const config = loadConfig({ env: process.env });
  const throttle = createTokenBucket({
    capacity: config.mugloarBurst,
    refillPerSecond: config.mugloarRatePerSecond,
    now: () => performance.now(),
    sleep: (ms) => sleep(ms),
  });
  const client = createMugloarClient({ config, fetchImpl: fetch, throttle });
  const db = createDatabase({ config });

  return { config, client, db };
};

export const consoleLogger: BotLogger = {
  info: (details, message) => console.log(message, JSON.stringify(details)),
  warn: (details, message) => console.warn(message, details),
};

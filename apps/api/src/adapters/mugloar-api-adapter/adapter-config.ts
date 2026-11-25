import { setTimeout as sleep } from 'node:timers/promises';

import { loadConfig } from '../../config/index.ts';
import type { AppConfig } from '../../config/index.ts';
import { createTokenBucket } from './throttle.ts';
import type { Throttle } from './throttle.ts';

export type MugloarApiConfig = Pick<
  AppConfig,
  | 'mugloarBaseUrl'
  | 'mugloarTimeoutMs'
  | 'mugloarReadRetries'
  | 'mugloarRetryBaseDelayMs'
  | 'mugloarRatePerSecond'
  | 'mugloarBurst'
>;

type MugloarApiRuntime = { config: MugloarApiConfig; throttle: Throttle };

let runtime: MugloarApiRuntime | undefined;

const buildRuntime = ({ config }: { config: MugloarApiConfig }): MugloarApiRuntime => ({
  config,
  throttle: createTokenBucket({
    capacity: config.mugloarBurst,
    refillPerSecond: config.mugloarRatePerSecond,
    now: () => performance.now(),
    sleep: ({ ms, signal }) => sleep(ms, undefined, { signal }),
  }),
});

// Called once by each composition root (the app, each CLI). One bucket per process,
// because what it protects is the remote host, not any caller.
export const configureMugloarApi = ({ config }: { config: MugloarApiConfig }): void => {
  runtime = buildRuntime({ config });
};

// A caller that never configured the adapter gets the environment, read once.
export const mugloarApiRuntime = (): MugloarApiRuntime => {
  runtime ??= buildRuntime({ config: loadConfig({ env: process.env }) });

  return runtime;
};

// A stable object over whichever bucket is configured, so tests can spy on acquire.
export const mugloarThrottle: Throttle = {
  acquire: ({ signal }) => mugloarApiRuntime().throttle.acquire({ signal }),
};

import { setTimeout as sleep } from 'node:timers/promises';

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

export type MugloarApiRuntime = { config: MugloarApiConfig; throttle: Throttle };

let runtime: MugloarApiRuntime | undefined;

// Called once by each composition root (the app, each CLI). One bucket per process,
// because what it protects is the remote host, not any caller.
export const configureMugloarApi = ({ config }: { config: MugloarApiConfig }): void => {
  runtime = {
    config,
    throttle: createTokenBucket({
      capacity: config.mugloarBurst,
      refillPerSecond: config.mugloarRatePerSecond,
      now: () => performance.now(),
      sleep: ({ ms, signal }) => sleep(ms, undefined, { signal }),
    }),
  };
};

// No environment fallback: a caller that skipped configureMugloarApi would otherwise talk to
// whatever host process.env happened to name.
export const mugloarApiRuntime = (): MugloarApiRuntime => {
  if (runtime === undefined) {
    throw new Error('The Mugloar API adapter is not configured: call configureMugloarApi first');
  }

  return runtime;
};

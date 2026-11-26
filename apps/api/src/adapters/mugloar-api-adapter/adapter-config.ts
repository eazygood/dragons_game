import PQueue from 'p-queue';

import type { AppConfig } from '../../config/index.ts';

export type MugloarApiConfig = Pick<
  AppConfig,
  | 'mugloarBaseUrl'
  | 'mugloarTimeoutMs'
  | 'mugloarReadRetries'
  | 'mugloarRetryBaseDelayMs'
  | 'mugloarRatePerSecond'
  | 'mugloarBurst'
>;

export type MugloarApiRuntime = { config: MugloarApiConfig; throttle: PQueue };

const MS_PER_SECOND = 1000;

let runtime: MugloarApiRuntime | undefined;

// Called once by each composition root (the app, each CLI). One throttle per process,
// because what it protects is the remote host, not any caller. A sliding window (`strict`)
// so a burst cannot straddle two windows and double up.
export const configureMugloarApi = ({ config }: { config: MugloarApiConfig }): void => {
  runtime = {
    config,
    throttle: new PQueue({
      intervalCap: config.mugloarBurst,
      interval: (config.mugloarBurst / config.mugloarRatePerSecond) * MS_PER_SECOND,
      strict: true,
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

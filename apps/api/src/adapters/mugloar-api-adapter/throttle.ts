import { setTimeout as sleep } from 'node:timers/promises';

import { loadConfig } from '../../config/index.ts';

export type Throttle = { acquire(): Promise<void> };

const MS_PER_SECOND = 1000;

export const createTokenBucket = ({
  capacity,
  refillPerSecond,
  now,
  sleep,
}: {
  capacity: number;
  refillPerSecond: number;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}): Throttle => {
  let tokens = capacity;
  let refilledAt = now();
  let queue: Promise<void> = Promise.resolve();

  const refill = () => {
    const current = now();

    tokens = Math.min(
      capacity,
      tokens + ((current - refilledAt) * refillPerSecond) / MS_PER_SECOND,
    );
    refilledAt = current;
  };

  const take = async () => {
    refill();

    if (tokens < 1) {
      await sleep(Math.ceil(((1 - tokens) * MS_PER_SECOND) / refillPerSecond));
      refill();
    }

    tokens -= 1;
  };

  return {
    // Waiters are chained, so concurrent callers queue instead of racing for one token.
    acquire: () => {
      const turn = queue.then(take);

      queue = turn.catch(() => undefined);

      return turn;
    },
  };
};

let bucket: Throttle | undefined;

// One bucket per process, because what it protects is the remote host, not any
// caller. Built on first use so it reads the config the process runs with.
export const mugloarThrottle: Throttle = {
  acquire: () => {
    if (!bucket) {
      const config = loadConfig({ env: process.env });

      bucket = createTokenBucket({
        capacity: config.mugloarBurst,
        refillPerSecond: config.mugloarRatePerSecond,
        now: () => performance.now(),
        sleep: (ms) => sleep(ms),
      });
    }

    return bucket.acquire();
  },
};

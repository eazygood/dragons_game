import type { Throttle } from './request.ts';

const MS_PER_SECOND = 1000;

// One bucket per process: what is protected is the remote host, not any caller.
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

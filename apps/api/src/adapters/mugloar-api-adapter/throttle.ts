export type Throttle = { acquire({ signal }: { signal: AbortSignal }): Promise<void> };

const MS_PER_SECOND = 1000;

const discardOutcome = () => undefined;

// Settles with `pending`, or rejects with the abort reason as soon as `signal` fires.
const untilAborted = ({
  pending,
  signal,
}: {
  pending: Promise<void>;
  signal: AbortSignal;
}): Promise<void> =>
  new Promise((resolve, reject) => {
    const rejectWithReason = () =>
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new Error('Throttle wait aborted', { cause: signal.reason }),
      );

    signal.addEventListener('abort', rejectWithReason, { once: true });
    void pending
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', rejectWithReason));

    if (signal.aborted) {
      rejectWithReason();
    }
  });

export const createTokenBucket = ({
  capacity,
  refillPerSecond,
  now,
  sleep,
}: {
  capacity: number;
  refillPerSecond: number;
  now: () => number;
  sleep: ({ ms, signal }: { ms: number; signal: AbortSignal }) => Promise<void>;
}): Throttle => {
  let tokens = capacity;
  let refilledAt = now();
  let queue: Promise<void> = Promise.resolve();

  const refill = () => {
    const refilledNow = now();

    tokens = Math.min(
      capacity,
      tokens + ((refilledNow - refilledAt) * refillPerSecond) / MS_PER_SECOND,
    );
    refilledAt = refilledNow;
  };

  const take = async ({ signal }: { signal: AbortSignal }) => {
    // A caller that gave up while queued must not spend a token.
    signal.throwIfAborted();
    refill();

    if (tokens < 1) {
      await sleep({ ms: Math.ceil(((1 - tokens) * MS_PER_SECOND) / refillPerSecond), signal });
      refill();
    }

    tokens -= 1;
  };

  return {
    // Waiters are chained, so concurrent callers queue instead of racing for one token.
    acquire: ({ signal }) => {
      const turn = queue.then(() => take({ signal }));

      queue = turn.then(discardOutcome, discardOutcome);

      return untilAborted({ pending: turn, signal });
    },
  };
};

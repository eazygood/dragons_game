import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTokenBucket } from '../../src/adapters/mugloar-api-adapter/throttle.ts';

let clock = 0;
const now = () => clock;
const sleep = vi.fn(({ ms }: { ms: number; signal: AbortSignal }) => {
  clock += ms;

  return Promise.resolve();
});
const signal = new AbortController().signal;

beforeEach(() => {
  clock = 0;
  sleep.mockClear();
});

describe('createTokenBucket', () => {
  it('lets a full burst through without waiting', async () => {
    const bucket = createTokenBucket({ capacity: 3, refillPerSecond: 1, now, sleep });

    await Promise.all([
      bucket.acquire({ signal }),
      bucket.acquire({ signal }),
      bucket.acquire({ signal }),
    ]);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('waits for a refill once the burst is spent', async () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 2, now, sleep });

    await bucket.acquire({ signal });
    await bucket.acquire({ signal });
    expect(sleep).toHaveBeenCalledWith(expect.objectContaining({ ms: 500 }));
  });

  it('queues concurrent callers so each waits for its own token instead of sharing one', async () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, now, sleep });

    await Promise.all([
      bucket.acquire({ signal }),
      bucket.acquire({ signal }),
      bucket.acquire({ signal }),
    ]);
    expect(clock).toBe(2000);
  });

  it('refills from elapsed time and never beyond capacity', async () => {
    const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 1, now, sleep });

    clock += 60_000;
    await Promise.all([
      bucket.acquire({ signal }),
      bucket.acquire({ signal }),
      bucket.acquire({ signal }),
    ]);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('gives up waiting as soon as the caller aborts', async () => {
    const neverRefills = () => new Promise<void>(() => undefined);
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, now, sleep: neverRefills });
    const caller = new AbortController();
    const reason = new Error('timed out');

    await bucket.acquire({ signal });
    const waiting = bucket.acquire({ signal: caller.signal });

    caller.abort(reason);
    await expect(waiting).rejects.toBe(reason);
  });

  it('spends no token for a caller that aborted while queued', async () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, now, sleep });
    const caller = new AbortController();

    caller.abort(new Error('gave up'));
    await expect(bucket.acquire({ signal: caller.signal })).rejects.toThrow('gave up');
    await bucket.acquire({ signal });
    expect(sleep).not.toHaveBeenCalled();
  });
});

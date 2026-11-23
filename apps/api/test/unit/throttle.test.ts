import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTokenBucket } from '../../src/adapters/mugloar-api-adapter/throttle.ts';

let clock = 0;
const now = () => clock;
const sleep = vi.fn((ms: number) => {
  clock += ms;

  return Promise.resolve();
});

beforeEach(() => {
  clock = 0;
  sleep.mockClear();
});

describe('createTokenBucket', () => {
  it('lets a full burst through without waiting', async () => {
    const bucket = createTokenBucket({ capacity: 3, refillPerSecond: 1, now, sleep });

    await Promise.all([bucket.acquire(), bucket.acquire(), bucket.acquire()]);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('waits for a refill once the burst is spent', async () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 2, now, sleep });

    await bucket.acquire();
    await bucket.acquire();
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it('is shared across callers, because the remote host is what is being protected', async () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerSecond: 1, now, sleep });

    await Promise.all([bucket.acquire(), bucket.acquire(), bucket.acquire()]);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('refills from elapsed time and never beyond capacity', async () => {
    const bucket = createTokenBucket({ capacity: 2, refillPerSecond: 1, now, sleep });

    clock += 60_000;
    await Promise.all([bucket.acquire(), bucket.acquire(), bucket.acquire()]);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});

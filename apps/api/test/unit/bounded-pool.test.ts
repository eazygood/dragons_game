import { describe, expect, it } from 'vitest';

import { runBounded } from '../../src/bot/bounded-pool.ts';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('runBounded', () => {
  it('never has more than `concurrency` tasks in flight', async () => {
    let inFlight = 0;
    let peak = 0;

    await runBounded({
      count: 7,
      concurrency: 3,
      task: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight -= 1;
      },
    });

    expect(peak).toBe(3);
  });

  it('returns every result in index order, whatever order they finish in', async () => {
    const results = await runBounded({
      count: 4,
      concurrency: 2,
      task: async (index) => {
        for (let wait = 0; wait < 4 - index; wait += 1) {
          await tick();
        }

        return index * 10;
      },
    });

    expect(results).toEqual([0, 10, 20, 30]);
  });
});

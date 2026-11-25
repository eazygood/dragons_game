import { describe, expect, it } from 'vitest';

import { runBounded } from '../../src/cli/bounded-pool.ts';

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

  it('returns every outcome in index order, whatever order they finish in', async () => {
    const outcomes = await runBounded({
      count: 4,
      concurrency: 2,
      task: async (index) => {
        for (let wait = 0; wait < 4 - index; wait += 1) {
          await tick();
        }

        return index * 10;
      },
    });

    expect(outcomes.map((outcome) => outcome.status === 'fulfilled' && outcome.value)).toEqual([
      0, 10, 20, 30,
    ]);
  });

  it('keeps starting tasks after one fails, and reports the failure in its slot', async () => {
    const failure = new Error('run 1 failed');
    const started: number[] = [];

    const outcomes = await runBounded({
      count: 5,
      concurrency: 2,
      task: async (index) => {
        started.push(index);
        await tick();

        if (index === 1) {
          throw failure;
        }

        return index;
      },
    });

    expect(started).toEqual([0, 1, 2, 3, 4]);
    expect(outcomes[1]).toEqual({ status: 'rejected', reason: failure });
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(4);
  });
});

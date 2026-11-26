import { TARGET_SCORE } from '@dragons-game/contracts';
import { describe, expect, it } from 'vitest';

import { summarise } from '../../src/cli/benchmark-report.ts';
import type { BotRunResult } from '../../src/cli/types.ts';

const TURNS = 40;
const DURATIONS_IN_MS = [2000, 4000];

const scores = (values: number[]): BotRunResult[] =>
  values.map((score, index) => ({
    gameId: `g${index}`,
    score,
    turns: TURNS + index,
    strategy: 'calibrated',
  }));

describe('summarise', () => {
  it('reports the pass rate against the 1000-point bar', () => {
    const summary = summarise({
      results: scores([467, 641, 765, 877, 1323, 1456, 6347, 6840]),
      runDurationsInMs: DURATIONS_IN_MS,
      target: TARGET_SCORE,
    });

    expect(summary.passRate).toBeCloseTo(0.5);
    expect(summary).toMatchObject({
      runs: 8,
      min: 467,
      max: 6840,
      target: TARGET_SCORE,
    });
  });

  it('reports the median, not the mean, because the distribution has a long tail', () => {
    expect(
      summarise({
        results: scores([100, 200, 9000]),
        runDurationsInMs: DURATIONS_IN_MS,
        target: TARGET_SCORE,
      }).median,
    ).toBe(200);
  });

  it('takes the midpoint of the two middle scores for an even run count', () => {
    expect(
      summarise({
        results: scores([900, 100, 1100, 9000]),
        runDurationsInMs: DURATIONS_IN_MS,
        target: TARGET_SCORE,
      }).median,
    ).toBe(1000);
  });

  it('counts a score exactly on the bar as a pass', () => {
    expect(
      summarise({
        results: scores([1000, 999]),
        runDurationsInMs: DURATIONS_IN_MS,
        target: TARGET_SCORE,
      }).passRate,
    ).toBe(0.5);
  });

  it('reports mean turns survived', () => {
    expect(
      summarise({
        results: scores([1, 2, 3]),
        runDurationsInMs: DURATIONS_IN_MS,
        target: TARGET_SCORE,
      }).meanTurns,
    ).toBe(TURNS + 1);
  });

  it('summarises no runs as zeros rather than NaN', () => {
    expect(summarise({ results: [], runDurationsInMs: [], target: TARGET_SCORE })).toEqual({
      runs: 0,
      failedRuns: 0,
      passRate: 0,
      passRateOfFinishedRuns: 0,
      min: 0,
      median: 0,
      max: 0,
      meanTurns: 0,
      meanDurationInSeconds: 0,
      target: TARGET_SCORE,
    });
  });

  it('reports the mean wall time of the runs in seconds', () => {
    const summary = summarise({
      results: scores([500, 1500]),
      runDurationsInMs: DURATIONS_IN_MS,
      target: TARGET_SCORE,
    });

    expect(summary.meanDurationInSeconds).toBe(3);
  });

  it('keeps a mean duration when every run failed, since the rows still carry times', () => {
    const summary = summarise({
      results: [],
      failedRuns: 2,
      runDurationsInMs: DURATIONS_IN_MS,
      target: TARGET_SCORE,
    });

    expect(summary).toMatchObject({ median: 0, meanDurationInSeconds: 3 });
  });
});

describe('summarise with failed runs', () => {
  it('counts a failed run as a miss, but not against the finished-run pass rate', () => {
    const summary = summarise({
      results: scores([1500, 500]),
      failedRuns: 2,
      runDurationsInMs: DURATIONS_IN_MS,
      target: TARGET_SCORE,
    });

    expect(summary).toMatchObject({
      runs: 4,
      failedRuns: 2,
      passRate: 0.25,
      passRateOfFinishedRuns: 0.5,
    });
  });

  it('describes scores and turns from finished runs only', () => {
    const summary = summarise({
      results: scores([300, 900]),
      failedRuns: 1,
      runDurationsInMs: DURATIONS_IN_MS,
      target: TARGET_SCORE,
    });

    expect(summary).toMatchObject({ min: 300, median: 600, max: 900, meanTurns: TURNS + 0.5 });
  });

  it('reports a benchmark where every run failed without NaN', () => {
    expect(
      summarise({
        results: [],
        failedRuns: 3,
        runDurationsInMs: DURATIONS_IN_MS,
        target: TARGET_SCORE,
      }),
    ).toMatchObject({
      runs: 3,
      failedRuns: 3,
      passRate: 0,
      median: 0,
    });
  });
});

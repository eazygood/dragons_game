import { TARGET_SCORE } from '@dragons-game/contracts';
import { describe, expect, it } from 'vitest';

import { formatSummary, summarise } from '../../src/cli/benchmark-report.ts';
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

describe('formatSummary', () => {
  it('prints the pass rate as a percentage alongside the distribution', () => {
    const summary = {
      ...summarise({
        results: scores([500, 1500]),
        runDurationsInMs: DURATIONS_IN_MS,
        target: TARGET_SCORE,
      }),
      benchmarkId: 'bench-1',
      strategy: 'calibrated' as const,
    };
    const text = formatSummary({ summary });

    expect(text).toContain('bench-1');
    expect(text).toContain('calibrated');
    expect(text).toContain('50%');
    expect(text).toContain('median 1000');
    expect(text).toContain('mean duration 3.0s');
  });

  it('prints how many runs failed', () => {
    const summary = {
      ...summarise({
        results: scores([500]),
        failedRuns: 1,
        runDurationsInMs: DURATIONS_IN_MS,
        target: TARGET_SCORE,
      }),
      benchmarkId: 'bench-1',
      strategy: 'calibrated' as const,
    };

    expect(formatSummary({ summary })).toContain('2 runs, 1 failed');
  });

  it('prints the finished-run pass rate only when some runs failed', () => {
    const withFailure = summarise({
      results: scores([1500]),
      failedRuns: 1,
      runDurationsInMs: DURATIONS_IN_MS,
      target: TARGET_SCORE,
    });
    const withoutFailure = summarise({
      results: scores([1500]),
      runDurationsInMs: DURATIONS_IN_MS,
      target: TARGET_SCORE,
    });
    const report = { benchmarkId: 'bench-1', strategy: 'calibrated' as const };

    expect(formatSummary({ summary: { ...withFailure, ...report } })).toContain(
      'pass rate 50% at >= 1000 · 100% of the 1 finished runs',
    );
    expect(formatSummary({ summary: { ...withoutFailure, ...report } })).not.toContain('finished');
  });
});

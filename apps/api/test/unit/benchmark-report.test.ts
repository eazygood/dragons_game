import { TARGET_SCORE } from '@bigbank-dragon/contracts';
import { describe, expect, it } from 'vitest';

import { formatSummary, summarise } from '../../src/bot/benchmark-report.ts';
import type { BotRunResult } from '../../src/bot/types.ts';

const TURNS = 40;

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
      target: TARGET_SCORE,
    });

    expect(summary.passRate).toBeCloseTo(0.5);
    expect(summary).toMatchObject({ runs: 8, min: 467, max: 6840, target: TARGET_SCORE });
  });

  it('reports the median, not the mean, because the distribution has a long tail', () => {
    expect(summarise({ results: scores([100, 200, 9000]), target: TARGET_SCORE }).median).toBe(200);
  });

  it('takes the midpoint of the two middle scores for an even run count', () => {
    expect(
      summarise({ results: scores([900, 100, 1100, 9000]), target: TARGET_SCORE }).median,
    ).toBe(1000);
  });

  it('counts a score exactly on the bar as a pass', () => {
    expect(summarise({ results: scores([1000, 999]), target: TARGET_SCORE }).passRate).toBe(0.5);
  });

  it('reports mean turns survived', () => {
    expect(summarise({ results: scores([1, 2, 3]), target: TARGET_SCORE }).meanTurns).toBe(
      TURNS + 1,
    );
  });

  it('summarises no runs as zeros rather than NaN', () => {
    expect(summarise({ results: [], target: TARGET_SCORE })).toEqual({
      runs: 0,
      passRate: 0,
      min: 0,
      median: 0,
      max: 0,
      meanTurns: 0,
      target: TARGET_SCORE,
    });
  });
});

describe('formatSummary', () => {
  it('prints the pass rate as a percentage alongside the distribution', () => {
    const summary = {
      ...summarise({ results: scores([500, 1500]), target: TARGET_SCORE }),
      benchmarkId: 'bench-1',
      strategy: 'calibrated' as const,
    };
    const text = formatSummary({ summary });

    expect(text).toContain('bench-1');
    expect(text).toContain('calibrated');
    expect(text).toContain('50%');
    expect(text).toContain('median 1000');
  });
});

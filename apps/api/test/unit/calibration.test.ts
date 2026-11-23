import { describe, expect, it } from 'vitest';

import {
  buildCalibration,
  levelBucket,
  priorCalibration,
} from '../../src/domain/engine/calibration.ts';
import { STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';
import type { CalibrationCount } from '../../src/entities/ad-attempt.ts';

const config = STRATEGY_CONFIG;

const calibratedFrom = (counts: CalibrationCount[]) => buildCalibration({ counts, config });

describe('calibration', () => {
  it('returns the prior when there is no evidence', () => {
    expect(calibratedFrom([]).estimate({ label: 'Sure thing', level: 0 })).toBeCloseTo(0.95);
  });

  it('applies Laplace smoothing with alpha 5', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, attempts: 12, successes: 2 },
    ]);

    // p̂ = (successes + α·prior) / (attempts + α)
    expect(calibration.estimate({ label: 'Sure thing', level: 6 })).toBeCloseTo(
      (2 + 5 * 0.95) / 17,
      5,
    );
  });

  it('lets measurement overtake the prior as evidence accumulates', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, attempts: 200, successes: 20 },
    ]);

    expect(calibration.estimate({ label: 'Sure thing', level: 6 })).toBeLessThan(0.2);
  });

  it('pools raw levels into buckets, because raw cells are too sparse', () => {
    const bucket = (level: number) => levelBucket({ level, config });

    expect(bucket(0)).toBe(bucket(1));
    expect(bucket(1)).not.toBe(bucket(2));
    expect(bucket(3)).not.toBe(bucket(4));
    expect(bucket(9)).toBe(bucket(6));
  });

  it('sums evidence from every level that shares a bucket', () => {
    const calibration = calibratedFrom([
      { probability: 'Gamble', dragonLevel: 2, attempts: 5, successes: 5 },
      { probability: 'Gamble', dragonLevel: 3, attempts: 5, successes: 0 },
    ]);

    expect(calibration.estimate({ label: 'Gamble', level: 2 })).toBeCloseTo((5 + 5 * 0.5) / 15, 5);
  });

  it('does not leak evidence across labels or buckets', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, attempts: 200, successes: 0 },
    ]);

    expect(calibration.estimate({ label: 'Sure thing', level: 0 })).toBeCloseTo(0.95);
    expect(calibration.estimate({ label: 'Piece of cake', level: 6 })).toBeCloseTo(0.9);
  });

  it('ignores evidence entirely in the baseline strategy', () => {
    const counts: CalibrationCount[] = [
      { probability: 'Sure thing', dragonLevel: 6, attempts: 200, successes: 0 },
    ];

    expect(priorCalibration({ config }).estimate({ label: 'Sure thing', level: 6 })).toBeCloseTo(
      0.95,
    );
    expect(calibratedFrom(counts).estimate({ label: 'Sure thing', level: 6 })).toBeLessThan(0.95);
  });

  it('keeps Impossible at zero however the evidence falls', () => {
    const calibration = calibratedFrom([
      { probability: 'Impossible', dragonLevel: 0, attempts: 4, successes: 4 },
    ]);

    expect(calibration.estimate({ label: 'Impossible', level: 0 })).toBe(0);
  });
});

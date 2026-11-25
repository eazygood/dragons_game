import { IMPOSSIBLE_LABEL, PROBABILITY_LABELS } from '@bigbank-dragon/contracts';
import { describe, expect, it } from 'vitest';

import { buildCalibration, levelBucket, rewardBand } from '../../src/domain/engine/calibration.ts';
import type { CalibrationCount } from '../../src/domain/engine/calibration.ts';
import { PROBABILITY_PRIOR, STRATEGY_CONFIG } from '../../src/domain/engine/strategy-config.ts';

const config = STRATEGY_CONFIG;
const CHEAP = 50;
const LUCRATIVE = 200;

const calibratedFrom = (counts: CalibrationCount[]) => buildCalibration({ counts, config });

describe('calibration', () => {
  it('returns the prior when there is no evidence', () => {
    expect(
      calibratedFrom([]).estimate({ label: 'Sure thing', level: 0, reward: CHEAP }),
    ).toBeCloseTo(0.95);
  });

  it('applies Laplace smoothing with the configured alpha', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, reward: CHEAP, attempts: 12, successes: 2 },
    ]);

    // p̂ = (successes + α·prior) / (attempts + α)
    expect(calibration.estimate({ label: 'Sure thing', level: 6, reward: CHEAP })).toBeCloseTo(
      (2 + config.smoothingAlpha * 0.95) / (12 + config.smoothingAlpha),
      5,
    );
  });

  it('lets measurement overtake the prior as evidence accumulates', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, reward: CHEAP, attempts: 200, successes: 20 },
    ]);

    expect(calibration.estimate({ label: 'Sure thing', level: 6, reward: CHEAP })).toBeLessThan(
      0.2,
    );
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
      { probability: 'Gamble', dragonLevel: 2, reward: CHEAP, attempts: 5, successes: 5 },
      { probability: 'Gamble', dragonLevel: 3, reward: CHEAP, attempts: 5, successes: 0 },
    ]);

    expect(calibration.estimate({ label: 'Gamble', level: 2, reward: CHEAP })).toBeCloseTo(
      (5 + 5 * 0.5) / 15,
      5,
    );
  });

  it('does not leak evidence across labels or buckets', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, reward: CHEAP, attempts: 200, successes: 0 },
    ]);

    expect(calibration.estimate({ label: 'Sure thing', level: 0, reward: CHEAP })).toBeCloseTo(
      0.95,
    );
    expect(calibration.estimate({ label: 'Piece of cake', level: 6, reward: CHEAP })).toBeCloseTo(
      0.9,
    );
  });

  it('keeps Impossible at zero however the evidence falls', () => {
    const calibration = calibratedFrom([
      { probability: 'Impossible', dragonLevel: 0, reward: CHEAP, attempts: 4, successes: 4 },
    ]);

    expect(calibration.estimate({ label: 'Impossible', level: 0, reward: CHEAP })).toBe(0);
  });

  it('keeps evidence on lucrative ads apart from cheap ads of the same label', () => {
    // Measured: Sure thing at reward 160+ went 1/45; below 100 it went 47/47.
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 2, reward: LUCRATIVE, attempts: 20, successes: 0 },
    ]);

    expect(calibration.estimate({ label: 'Sure thing', level: 2, reward: LUCRATIVE })).toBeLessThan(
      0.2,
    );
    expect(calibration.estimate({ label: 'Sure thing', level: 2, reward: CHEAP })).toBeCloseTo(
      0.95,
    );
  });

  it('pools rewards into bands at the configured edges', () => {
    const band = (reward: number) => rewardBand({ reward, config });

    expect(band(1)).toBe(band(99));
    expect(band(99)).not.toBe(band(100));
    expect(band(159)).not.toBe(band(160));
    expect(band(160)).toBe(band(400));
  });
});

describe('probability prior', () => {
  it('gives every label a prior and ranks them monotonically', () => {
    const priors = PROBABILITY_LABELS.map((label) => PROBABILITY_PRIOR[label]);

    expect(priors).toHaveLength(PROBABILITY_LABELS.length);
    expect([...priors].sort((a, b) => b - a)).toEqual(priors);
    expect(PROBABILITY_PRIOR[IMPOSSIBLE_LABEL]).toBe(0);
  });
});

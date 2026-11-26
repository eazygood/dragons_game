import { PROBABILITY_LABELS } from '@dragons-game/contracts';
import { describe, expect, it } from 'vitest';

import { buildCalibration, withAttempt } from '../../src/engine/calibration.ts';
import type { CalibrationAttempt, CalibrationCount } from '../../src/engine/calibration.ts';
import { STRATEGY_CONFIG } from '../../src/engine/strategy-config.ts';

const config = STRATEGY_CONFIG;
const CHEAP = 50;
const LUCRATIVE = 200;

const calibratedFrom = (counts: CalibrationCount[]) => buildCalibration({ counts, config });

describe('calibration', () => {
  it('returns the prior when there is no evidence', () => {
    expect(
      calibratedFrom([]).estimate({ label: 'Sure thing', dragonLevel: 0, reward: CHEAP }),
    ).toBeCloseTo(0.95);
  });

  it('applies Laplace smoothing with the configured alpha', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, reward: CHEAP, attempts: 12, successes: 2 },
    ]);

    // p̂ = (successes + α·prior) / (attempts + α)
    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 6, reward: CHEAP }),
    ).toBeCloseTo((2 + config.smoothingAlpha * 0.95) / (12 + config.smoothingAlpha), 5);
  });

  it('lets measurement overtake the prior as evidence accumulates', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, reward: CHEAP, attempts: 200, successes: 20 },
    ]);

    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 6, reward: CHEAP }),
    ).toBeLessThan(0.2);
  });

  it('sums evidence from every level that shares a bucket', () => {
    const calibration = calibratedFrom([
      { probability: 'Gamble', dragonLevel: 2, reward: CHEAP, attempts: 5, successes: 5 },
      { probability: 'Gamble', dragonLevel: 3, reward: CHEAP, attempts: 5, successes: 0 },
    ]);

    expect(calibration.estimate({ label: 'Gamble', dragonLevel: 2, reward: CHEAP })).toBeCloseTo(
      (5 + 5 * 0.5) / 15,
      5,
    );
  });

  it('does not leak evidence across labels or buckets', () => {
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 6, reward: CHEAP, attempts: 200, successes: 0 },
    ]);

    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 0, reward: CHEAP }),
    ).toBeCloseTo(0.95);
    expect(
      calibration.estimate({ label: 'Piece of cake', dragonLevel: 6, reward: CHEAP }),
    ).toBeCloseTo(0.9);
  });

  it('keeps Impossible at zero however the evidence falls', () => {
    const calibration = calibratedFrom([
      { probability: 'Impossible', dragonLevel: 0, reward: CHEAP, attempts: 4, successes: 4 },
    ]);

    expect(calibration.estimate({ label: 'Impossible', dragonLevel: 0, reward: CHEAP })).toBe(0);
  });

  it('keeps evidence on lucrative ads apart from cheap ads of the same label', () => {
    // Measured: Sure thing at reward 160+ went 1/45; below 100 it went 47/47.
    const calibration = calibratedFrom([
      { probability: 'Sure thing', dragonLevel: 2, reward: LUCRATIVE, attempts: 20, successes: 0 },
    ]);

    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 2, reward: LUCRATIVE }),
    ).toBeLessThan(0.2);
    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 2, reward: CHEAP }),
    ).toBeCloseTo(0.95);
  });
});

describe('probability prior', () => {
  it('ranks the labels monotonically', () => {
    const priors = PROBABILITY_LABELS.map((label) => config.probabilityPrior[label]);

    expect([...priors].sort((a, b) => b - a)).toEqual(priors);
  });
});

// The same GROUP BY the ad_attempts repository runs: one count per (label, level, reward).
const aggregate = ({ attempts }: { attempts: CalibrationAttempt[] }): CalibrationCount[] => {
  const cells = new Map<string, CalibrationCount>();

  for (const { probability, dragonLevel, reward, success } of attempts) {
    const key = `${probability}|${dragonLevel}|${reward}`;
    const cell = cells.get(key) ?? { probability, dragonLevel, reward, attempts: 0, successes: 0 };

    cells.set(key, {
      ...cell,
      attempts: cell.attempts + 1,
      successes: cell.successes + (success ? 1 : 0),
    });
  }

  return [...cells.values()];
};

const attempt = (overrides: Partial<CalibrationAttempt>): CalibrationAttempt => ({
  probability: 'Sure thing',
  dragonLevel: 0,
  reward: CHEAP,
  success: true,
  ...overrides,
});

// Spreads attempts over raw levels that share a bucket and rewards that share a band, and over
// cells that do not, because the fold must agree with the aggregation on both.
const MIXED_ATTEMPTS: CalibrationAttempt[] = [
  attempt({ dragonLevel: 0, reward: 30 }),
  attempt({ dragonLevel: 1, reward: 99 }),
  attempt({ dragonLevel: 1, reward: 99, success: false }),
  attempt({ dragonLevel: 2, reward: 99, success: false }),
  attempt({ dragonLevel: 3, reward: 100, success: false }),
  attempt({ dragonLevel: 2, reward: LUCRATIVE, success: false }),
  attempt({ probability: 'Gamble', dragonLevel: 6, reward: 100 }),
  attempt({ probability: 'Gamble', dragonLevel: 9, reward: 400, success: false }),
  attempt({ probability: 'Impossible', dragonLevel: 0, reward: CHEAP, success: false }),
];

describe('withAttempt', () => {
  it('equals the calibration rebuilt from the table after the same attempts', () => {
    const folded = MIXED_ATTEMPTS.reduce(
      (calibration, next) => withAttempt({ calibration, attempt: next }),
      calibratedFrom([]),
    );
    const rebuilt = calibratedFrom(aggregate({ attempts: MIXED_ATTEMPTS }));

    expect(folded.evidence).toEqual(rebuilt.evidence);
  });

  it('equals a rebuild when it extends evidence that was already measured', () => {
    const earlier = MIXED_ATTEMPTS.slice(0, 4);
    const later = MIXED_ATTEMPTS.slice(4);
    const folded = later.reduce(
      (calibration, next) => withAttempt({ calibration, attempt: next }),
      calibratedFrom(aggregate({ attempts: earlier })),
    );

    expect(folded.evidence).toEqual(
      calibratedFrom(aggregate({ attempts: MIXED_ATTEMPTS })).evidence,
    );
  });

  it('counts a failure as an attempt without a success', () => {
    const calibration = withAttempt({
      calibration: calibratedFrom([]),
      attempt: attempt({ success: false }),
    });

    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 0, reward: CHEAP }),
    ).toBeCloseTo((config.smoothingAlpha * 0.95) / (1 + config.smoothingAlpha), 5);
  });

  it('moves the estimate only for the bucket and band the attempt landed in', () => {
    const calibration = withAttempt({
      calibration: calibratedFrom([]),
      attempt: attempt({ dragonLevel: 6, reward: LUCRATIVE, success: false }),
    });

    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 9, reward: LUCRATIVE + 1 }),
    ).toBeLessThan(0.95);
    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 6, reward: CHEAP }),
    ).toBeCloseTo(0.95);
    expect(
      calibration.estimate({ label: 'Sure thing', dragonLevel: 0, reward: LUCRATIVE }),
    ).toBeCloseTo(0.95);
  });

  it('leaves the calibration it was given untouched', () => {
    const before = calibratedFrom([]);

    withAttempt({ calibration: before, attempt: attempt({ success: false }) });

    expect(before.evidence.size).toBe(0);
  });
});

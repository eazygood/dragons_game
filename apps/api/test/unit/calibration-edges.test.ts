import type { ProbabilityLabel } from '@dragons-game/contracts';
import { describe, expect, it } from 'vitest';

import { buildCalibration } from '../../src/engine/calibration.ts';
import { STRATEGY_CONFIG } from '../../src/engine/strategy-config.ts';

// An edge starts the cell above it, so evidence recorded exactly on an edge must move the
// estimate there and leave the cell one below at the prior.
const config = STRATEGY_CONFIG;
const LABEL: ProbabilityLabel = 'Sure thing';
const PRIOR = config.probabilityPrior[LABEL];
const BOTTOM_LEVEL = 0;
const CHEAP = 50;
const FAILED_ATTEMPTS = 10;

const failuresAt = ({ dragonLevel, reward }: { dragonLevel: number; reward: number }) =>
  buildCalibration({
    counts: [{ probability: LABEL, dragonLevel, reward, attempts: FAILED_ATTEMPTS, successes: 0 }],
    config,
  });

describe('calibration edges', () => {
  it.each(config.rewardBandEdges)('a reward of %d starts a new band', (edge) => {
    const calibration = failuresAt({ dragonLevel: BOTTOM_LEVEL, reward: edge });

    expect(
      calibration.estimate({ label: LABEL, dragonLevel: BOTTOM_LEVEL, reward: edge }),
    ).toBeLessThan(PRIOR);
    expect(
      calibration.estimate({ label: LABEL, dragonLevel: BOTTOM_LEVEL, reward: edge - 1 }),
    ).toBeCloseTo(PRIOR);
  });

  it.each(config.levelBucketEdges)('dragon level %d starts a new bucket', (edge) => {
    const calibration = failuresAt({ dragonLevel: edge, reward: CHEAP });

    expect(calibration.estimate({ label: LABEL, dragonLevel: edge, reward: CHEAP })).toBeLessThan(
      PRIOR,
    );
    expect(
      calibration.estimate({ label: LABEL, dragonLevel: edge - 1, reward: CHEAP }),
    ).toBeCloseTo(PRIOR);
  });
});

import { IMPOSSIBLE_LABEL, PROBABILITY_PRIOR } from '@bigbank-dragon/contracts';
import type { ProbabilityLabel } from '@bigbank-dragon/contracts';

import type { CalibrationCount } from '../../entities/ad-attempt.ts';
import type { StrategyConfig } from './strategy-config.ts';

export type Calibration = {
  estimate({ label, level }: { label: ProbabilityLabel; level: number }): number;
};

type Evidence = { attempts: number; successes: number };

export const levelBucket = ({ level, config }: { level: number; config: StrategyConfig }) =>
  config.levelBucketEdges.filter((edge) => level >= edge).length;

const cellKey = ({ label, bucket }: { label: ProbabilityLabel; bucket: number }) =>
  `${label}:${bucket}`;

export const buildCalibration = ({
  counts,
  config,
}: {
  counts: CalibrationCount[];
  config: StrategyConfig;
}): Calibration => {
  const cells = new Map<string, Evidence>();

  for (const { probability, dragonLevel, attempts, successes } of counts) {
    const key = cellKey({
      label: probability,
      bucket: levelBucket({ level: dragonLevel, config }),
    });
    const cell = cells.get(key) ?? { attempts: 0, successes: 0 };

    cells.set(key, { attempts: cell.attempts + attempts, successes: cell.successes + successes });
  }

  return {
    estimate: ({ label, level }) => {
      // Never estimated: 0/16 in the spike, and one lucky row must not revive it.
      if (label === IMPOSSIBLE_LABEL) {
        return 0;
      }

      const prior = PROBABILITY_PRIOR[label];
      const cell = cells.get(cellKey({ label, bucket: levelBucket({ level, config }) }));

      if (!cell) {
        return prior;
      }

      const alpha = config.smoothingAlpha;

      return (cell.successes + alpha * prior) / (cell.attempts + alpha);
    },
  };
};

// The baseline is the same estimator with no evidence, so the two strategies
// cannot drift apart in anything but what they have measured.
export const priorCalibration = ({ config }: { config: StrategyConfig }): Calibration =>
  buildCalibration({ counts: [], config });

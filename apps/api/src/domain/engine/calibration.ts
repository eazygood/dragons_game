import { IMPOSSIBLE_LABEL, PROBABILITY_PRIOR } from '@bigbank-dragon/contracts';
import type { ProbabilityLabel } from '@bigbank-dragon/contracts';

import type { CalibrationCount } from '../../entities/ad-attempt.ts';
import type { StrategyConfig } from './strategy-config.ts';

export type Calibration = {
  estimate({
    label,
    level,
    reward,
  }: {
    label: ProbabilityLabel;
    level: number;
    reward: number;
  }): number;
};

type Evidence = { attempts: number; successes: number };

export const levelBucket = ({ level, config }: { level: number; config: StrategyConfig }) =>
  config.levelBucketEdges.filter((edge) => level >= edge).length;

// Measured: the label stops meaning what it says above a reward, so it is a key too.
export const rewardBand = ({ reward, config }: { reward: number; config: StrategyConfig }) =>
  config.rewardBandEdges.filter((edge) => reward >= edge).length;

type CellCoordinates = { label: ProbabilityLabel; level: number; reward: number };

const cellKey = ({ label, level, reward, config }: CellCoordinates & { config: StrategyConfig }) =>
  `${label}:${levelBucket({ level, config })}:${rewardBand({ reward, config })}`;

export const buildCalibration = ({
  counts,
  config,
}: {
  counts: CalibrationCount[];
  config: StrategyConfig;
}): Calibration => {
  const cells = new Map<string, Evidence>();

  for (const { probability, dragonLevel, reward, attempts, successes } of counts) {
    const key = cellKey({ label: probability, level: dragonLevel, reward, config });
    const cell = cells.get(key) ?? { attempts: 0, successes: 0 };

    cells.set(key, { attempts: cell.attempts + attempts, successes: cell.successes + successes });
  }

  return {
    estimate: ({ label, level, reward }) => {
      // Never estimated: 0/16 in the spike, and one lucky row must not revive it.
      if (label === IMPOSSIBLE_LABEL) {
        return 0;
      }

      const prior = PROBABILITY_PRIOR[label];
      const cell = cells.get(cellKey({ label, level, reward, config }));

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

import type { ProbabilityLabel } from '@dragons-game/contracts';

import type { StrategyConfig } from './strategy-config.ts';

export const IMPOSSIBLE_LABEL = 'Impossible' satisfies ProbabilityLabel;

// The engine's input shape; the repository maps stored attempts into it.
export interface CalibrationCount {
  probability: ProbabilityLabel;
  dragonLevel: number;
  reward: number;
  attempts: number;
  successes: number;
}

// One solve as the SQL aggregation sees it: every attempt counts, whatever its rule or outcome.
export type CalibrationAttempt = Pick<
  CalibrationCount,
  'probability' | 'dragonLevel' | 'reward'
> & {
  success: boolean;
};

export type Calibration = {
  estimate({
    label,
    dragonLevel,
    reward,
  }: {
    label: ProbabilityLabel;
    dragonLevel: number;
    reward: number;
  }): number;
};

type Evidence = { attempts: number; successes: number };

// The estimator together with the evidence behind it, so a bot can fold in its own
// attempts during a game instead of re-reading the database every turn.
export type MeasuredCalibration = Calibration & {
  readonly evidence: ReadonlyMap<string, Evidence>;
  readonly config: StrategyConfig;
};

const levelBucket = ({ dragonLevel, config }: { dragonLevel: number; config: StrategyConfig }) =>
  config.levelBucketEdges.filter((edge) => dragonLevel >= edge).length;

// Measured: the label stops meaning what it says above a reward, so it is a key too.
const rewardBand = ({ reward, config }: { reward: number; config: StrategyConfig }) =>
  config.rewardBandEdges.filter((edge) => reward >= edge).length;

type CellCoordinates = { label: ProbabilityLabel; dragonLevel: number; reward: number };

const cellKey = ({
  label,
  dragonLevel,
  reward,
  config,
}: CellCoordinates & { config: StrategyConfig }) =>
  `${label}:${levelBucket({ dragonLevel, config })}:${rewardBand({ reward, config })}`;

const accumulate = ({
  evidence,
  key,
  added,
}: {
  evidence: Map<string, Evidence>;
  key: string;
  added: Evidence;
}): void => {
  const cell = evidence.get(key) ?? { attempts: 0, successes: 0 };

  evidence.set(key, {
    attempts: cell.attempts + added.attempts,
    successes: cell.successes + added.successes,
  });
};

const calibrationFromEvidence = ({
  evidence,
  config,
}: {
  evidence: ReadonlyMap<string, Evidence>;
  config: StrategyConfig;
}): MeasuredCalibration => ({
  evidence,
  config,
  estimate: ({ label, dragonLevel, reward }) => {
    // Never estimated: 0/16 in the spike, and one lucky row must not revive it.
    if (label === IMPOSSIBLE_LABEL) {
      return 0;
    }

    const prior = config.probabilityPrior[label];
    const cell = evidence.get(cellKey({ label, dragonLevel, reward, config }));

    if (!cell) {
      return prior;
    }

    const alpha = config.smoothingAlpha;

    return (cell.successes + alpha * prior) / (cell.attempts + alpha);
  },
});

export const buildCalibration = ({
  counts,
  config,
}: {
  counts: CalibrationCount[];
  config: StrategyConfig;
}): MeasuredCalibration => {
  const evidence = new Map<string, Evidence>();

  for (const { probability, dragonLevel, reward, attempts, successes } of counts) {
    const key = cellKey({ label: probability, dragonLevel, reward, config });

    accumulate({ evidence, key, added: { attempts, successes } });
  }

  return calibrationFromEvidence({ evidence, config });
};

// Mirrors one more row of the aggregation behind `buildCalibration`, so a calibration
// kept up to date in memory equals one freshly built from the table.
export const withAttempt = ({
  calibration,
  attempt,
}: {
  calibration: MeasuredCalibration;
  attempt: CalibrationAttempt;
}): MeasuredCalibration => {
  const { config } = calibration;
  const evidence = new Map(calibration.evidence);
  const key = cellKey({
    label: attempt.probability,
    dragonLevel: attempt.dragonLevel,
    reward: attempt.reward,
    config,
  });

  accumulate({ evidence, key, added: { attempts: 1, successes: attempt.success ? 1 : 0 } });

  return calibrationFromEvidence({ evidence, config });
};

// The baseline is the same estimator with no evidence, so the two strategies
// cannot drift apart in anything but what they have measured.
export const priorCalibration = ({ config }: { config: StrategyConfig }): MeasuredCalibration =>
  buildCalibration({ counts: [], config });

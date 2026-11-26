import { IMPOSSIBLE_LABEL } from '@dragons-game/contracts';
import type { Ad, GameState } from '@dragons-game/contracts';

import type { Calibration } from './calibration.ts';
import type { StrategyConfig } from './strategy-config.ts';

export type ScoredAd = { ad: Ad; estimatedProbability: number; expectedValue: number };

export const isAttemptable = ({ ad }: { ad: Ad }) =>
  ad.probability !== IMPOSSIBLE_LABEL && ad.expiresIn > 0;

// Pricing a lost life in gold puts risky-lucrative and safe-cheap ads on one axis.
const lifeCost = ({ config }: { config: StrategyConfig }) =>
  config.lifeCostInGold + config.turnCostInGold;

// Code-point order, not localeCompare, so the tiebreak cannot vary with the runtime locale.
const compareCodePoints = ({ left, right }: { left: string; right: string }) =>
  left < right ? -1 : Number(left > right);

const byExpectedValueThenAdId = (left: ScoredAd, right: ScoredAd) =>
  right.expectedValue - left.expectedValue ||
  compareCodePoints({ left: left.ad.adId, right: right.ad.adId });

type ScoreInput = {
  state: GameState;
  calibration: Calibration;
  config: StrategyConfig;
};

export const scoreAd = ({ ad, state, calibration, config }: ScoreInput & { ad: Ad }): ScoredAd => {
  const estimatedProbability = calibration.estimate({
    label: ad.probability,
    level: state.dragonLevel,
    reward: ad.reward,
  });
  const expectedValue =
    estimatedProbability * ad.reward - (1 - estimatedProbability) * lifeCost({ config });

  return { ad, estimatedProbability, expectedValue };
};

export const scoreAds = ({ board, ...input }: ScoreInput & { board: Ad[] }): ScoredAd[] =>
  board
    .filter((ad) => isAttemptable({ ad }))
    .map((ad) => scoreAd({ ad, ...input }))
    .sort(byExpectedValueThenAdId);

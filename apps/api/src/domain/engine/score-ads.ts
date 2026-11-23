import { IMPOSSIBLE_LABEL } from '@bigbank-dragon/contracts';
import type { Ad, GameState } from '@bigbank-dragon/contracts';

import type { Calibration } from './calibration.ts';
import type { StrategyConfig } from './strategy-config.ts';

export type ScoredAd = { ad: Ad; estimatedProbability: number; expectedValue: number };

const isAttemptable = ({ ad }: { ad: Ad }) =>
  ad.probability !== IMPOSSIBLE_LABEL && ad.expiresIn > 0;

// Pricing a lost life in gold puts risky-lucrative and safe-cheap ads on one axis.
const lifeCost = ({ config }: { config: StrategyConfig }) =>
  config.lifeCostInGold + config.turnCostInGold;

const byExpectedValueThenAdId = (left: ScoredAd, right: ScoredAd) =>
  right.expectedValue - left.expectedValue || left.ad.adId.localeCompare(right.ad.adId);

export const scoreAds = ({
  board,
  state,
  calibration,
  config,
}: {
  board: Ad[];
  state: GameState;
  calibration: Calibration;
  config: StrategyConfig;
}): ScoredAd[] =>
  board
    .filter((ad) => isAttemptable({ ad }))
    .map((ad) => {
      const estimatedProbability = calibration.estimate({
        label: ad.probability,
        level: state.dragonLevel,
      });
      const expectedValue =
        estimatedProbability * ad.reward - (1 - estimatedProbability) * lifeCost({ config });

      return { ad, estimatedProbability, expectedValue };
    })
    .sort(byExpectedValueThenAdId);

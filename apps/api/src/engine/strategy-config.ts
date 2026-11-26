import { TARGET_SCORE } from '@dragons-game/contracts';
import type { ProbabilityLabel } from '@dragons-game/contracts';

export interface StrategyConfig {
  /** Pseudo-observations of the prior; how much evidence it takes to move it. */
  readonly smoothingAlpha: number;
  /** What each label is worth before any evidence; calibration smooths measurements toward it. */
  readonly probabilityPrior: Readonly<Record<ProbabilityLabel, number>>;
  /** A level at or above each edge starts a new calibration bucket. */
  readonly levelBucketEdges: readonly number[];
  /** A reward at or above each edge starts a new calibration band. */
  readonly rewardBandEdges: readonly number[];
  readonly livesFloor: number;
  readonly minimumProbability: number;
  readonly lifeCostInGold: number;
  readonly turnCostInGold: number;
  /** Level-ups start once the score reaches this; null never buys one. */
  readonly levelUpFromScore: number | null;
  /** Gold a level-up must leave behind, so a potion stays affordable. */
  readonly levelUpGoldReserve: number;
}

// Every strategy threshold lives here and nowhere else.
export const STRATEGY_CONFIG: StrategyConfig = {
  smoothingAlpha: 2,
  probabilityPrior: {
    'Sure thing': 0.95,
    'Piece of cake': 0.9,
    'Walk in the park': 0.85,
    'Quite likely': 0.75,
    'Hmmm....': 0.6,
    Gamble: 0.5,
    Risky: 0.4,
    'Rather detrimental': 0.3,
    'Playing with fire': 0.2,
    'Suicide mission': 0.1,
    Impossible: 0,
  },
  levelBucketEdges: [2, 4, 6],
  rewardBandEdges: [100, 160],
  livesFloor: 3,
  minimumProbability: 0.45,
  lifeCostInGold: 50,
  turnCostInGold: 20,
  levelUpFromScore: TARGET_SCORE,
  levelUpGoldReserve: 50,
};

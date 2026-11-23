export interface StrategyConfig {
  /** Pseudo-observations of the prior; how much evidence it takes to move it. */
  readonly smoothingAlpha: number;
  /** A level at or above each edge starts a new calibration bucket. */
  readonly levelBucketEdges: readonly number[];
  /** A reward at or above each edge starts a new calibration band. */
  readonly rewardBandEdges: readonly number[];
  readonly livesFloor: number;
  readonly minimumProbability: number;
  readonly lifeCostInGold: number;
  readonly turnCostInGold: number;
  readonly levelUpEnabled: boolean;
  readonly levelUpGoldReserve: number;
}

// Every strategy threshold lives here and nowhere else.
export const STRATEGY_CONFIG: StrategyConfig = {
  smoothingAlpha: 5,
  levelBucketEdges: [2, 4, 6],
  rewardBandEdges: [100, 160],
  livesFloor: 2,
  minimumProbability: 0.45,
  lifeCostInGold: 50,
  turnCostInGold: 20,
  levelUpEnabled: true,
  levelUpGoldReserve: 350,
};

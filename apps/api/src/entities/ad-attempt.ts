import type { DecisionRule, ProbabilityLabel } from '@dragons-game/contracts';

import type { GameRunId } from './game-run.ts';

export interface AdAttempt {
  gameRunId: GameRunId;
  adId: string;
  probability: ProbabilityLabel;
  dragonLevel: number;
  turn: number;
  reward: number;
  success: boolean;
  estimatedProbability: number;
  expectedValue: number;
  // Null on rows written before the rule was recorded.
  rule: DecisionRule | null;
  createdAt: Date;
}

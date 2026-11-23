import type { ProbabilityLabel } from '@bigbank-dragon/contracts';

import type { GameRunId } from './game-run.ts';

export interface AdAttempt {
  gameRunId: GameRunId;
  adId: string;
  probability: ProbabilityLabel;
  dragonLevel: number;
  turn: number;
  reward: number;
  wasEncrypted: boolean;
  success: boolean;
  estimatedProbability: number;
  expectedValue: number;
  createdAt: Date;
}

export interface CalibrationCount {
  probability: ProbabilityLabel;
  dragonLevel: number;
  reward: number;
  attempts: number;
  successes: number;
}

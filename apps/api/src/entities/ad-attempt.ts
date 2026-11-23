import type { ProbabilityLabel } from '@bigbank-dragon/contracts';

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
  createdAt: Date;
}

// What a solve reports back; the turn's attempt row is built from it.
export interface SolveOutcome {
  success: boolean;
  lives: number;
  gold: number;
  score: number;
  turn: number;
  message: string;
}

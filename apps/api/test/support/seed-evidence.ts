import type { ProbabilityLabel } from '@dragons-game/contracts';
import type { Knex } from 'knex';

import * as adAttemptRepository from '../../src/repositories/ad-attempt-repository.ts';
import * as gameRunRepository from '../../src/repositories/game-run-repository.ts';

export type EvidenceCell = {
  label: ProbabilityLabel;
  level: number;
  reward: number;
  attempts: number;
  successes: number;
};

// Stores finished attempts under one earlier game, so calibration has history to read.
export const seedEvidence = async ({
  db,
  cells,
  benchmarkId = null,
}: {
  db: Knex;
  cells: EvidenceCell[];
  benchmarkId?: string | null;
}): Promise<void> => {
  const gameRunId = await gameRunRepository.createOne({
    db,
    gameRun: {
      gameId: `seeded-${benchmarkId ?? 'history'}`,
      strategy: 'calibrated',
      benchmarkId,
      lives: 0,
      gold: 0,
      dragonLevel: 0,
      turn: 0,
      score: 0,
      status: 'game_over',
      startedAt: new Date(),
      endedAt: new Date(),
    },
  });

  for (const { label, level, reward, attempts, successes } of cells) {
    for (let index = 0; index < attempts; index += 1) {
      await adAttemptRepository.createOne({
        db,
        attempt: {
          gameRunId,
          adId: `seed-${label}-${index}`,
          probability: label,
          dragonLevel: level,
          turn: index,
          reward,
          success: index < successes,
          estimatedProbability: 0.5,
          expectedValue: 0,
          rule: null,
          createdAt: new Date(),
        },
      });
    }
  }
};
